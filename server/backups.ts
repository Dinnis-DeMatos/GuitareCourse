import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { backupDays, backupsDir, exclusive, writeAtomic } from './jsonStore.ts'

/** Nombre de jours de sauvegardes gardés. */
export const KEPT_DAYS = 7

/** L'état des données juste avant une restauration, pour pouvoir revenir en arrière. */
export const BEFORE_RESTORE = 'avant-restauration'

/** Date du jour, à l'heure de l'ordinateur (« 2026-10-26 »). */
function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Copie dans `dir` les fichiers lisibles ; un fichier absent ou abîmé n'écrase pas une bonne copie déjà là. */
async function copyReadable(files: string[], dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  for (const file of files) {
    try {
      JSON.parse(await readFile(file, 'utf8'))
    } catch {
      continue
    }
    await copyFile(file, path.join(dir, path.basename(file)))
  }
}

/**
 * Sauvegarde du jour, faite au démarrage : une par jour (un nouveau démarrage le même jour la met à
 * jour), les `KEPT_DAYS` derniers jours gardés.
 */
export function backupDataFiles(files: string[], day = today()): Promise<void> {
  return exclusive(async () => {
    const dir = backupsDir(files[0])
    await copyReadable(files, path.join(dir, day))
    for (const old of (await backupDays(dir)).slice(KEPT_DAYS)) {
      await rm(path.join(dir, old), { recursive: true, force: true })
    }
  })
}

export interface Backup {
  /** Le jour (« 2026-10-26 »), ou `BEFORE_RESTORE`. */
  name: string
  /** Les fichiers qu'elle contient. */
  files: string[]
}

/** Les sauvegardes disponibles, la plus récente d'abord ; l'état d'avant la dernière restauration en tête. */
export async function listBackups(files: string[]): Promise<Backup[]> {
  const dir = backupsDir(files[0])
  const names = [...(await backupDays(dir))]
  try {
    await readdir(path.join(dir, BEFORE_RESTORE))
    names.unshift(BEFORE_RESTORE)
  } catch {
    // Pas encore de restauration.
  }
  const known = new Set(files.map((file) => path.basename(file)))
  return Promise.all(
    names.map(async (name) => ({
      name,
      files: (await readdir(path.join(dir, name))).filter((file) => known.has(file)),
    })),
  )
}

/**
 * Remet les données d'une sauvegarde. L'état actuel est d'abord gardé sous `BEFORE_RESTORE` ; un
 * fichier que la sauvegarde ne contient pas est laissé tel quel. false si la sauvegarde n'existe pas.
 */
export async function restoreBackup(files: string[], name: string): Promise<boolean> {
  if (!(await listBackups(files)).some((backup) => backup.name === name)) return false
  return exclusive(async () => {
    const dir = backupsDir(files[0])
    const source = path.join(dir, name)
    // Restaurer « avant-restauration » ne doit pas l'écraser avant de l'avoir lu : on le lit d'abord.
    const texts = new Map<string, string>()
    for (const file of files) {
      try {
        texts.set(file, await readFile(path.join(source, path.basename(file)), 'utf8'))
      } catch {
        // Absent de cette sauvegarde.
      }
    }
    const before = path.join(dir, BEFORE_RESTORE)
    await rm(before, { recursive: true, force: true })
    await copyReadable(files, before)
    for (const [file, text] of texts) await writeAtomic(file, text)
    return true
  })
}
