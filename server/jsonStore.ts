import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Les sauvegardes vivent dans ce dossier, à côté des fichiers de données. */
export const BACKUPS_DIR = 'sauvegardes'

export function backupsDir(file: string): string {
  return path.join(path.dirname(file), BACKUPS_DIR)
}

/** Sauvegardes quotidiennes, nommées par leur date (« 2026-10-26 ») ; la plus récente d'abord. */
export async function backupDays(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort().reverse()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

/** Écriture dans un fichier temporaire puis renommage : jamais de fichier à moitié écrit. */
export async function writeAtomic(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  await writeFile(temporary, text, 'utf8')
  await rename(temporary, file)
}

/** Un fichier abîmé qu'on a remplacé : par quelle sauvegarde (null : aucune), et où l'original est gardé. */
export interface Recovery {
  file: string
  backup: string | null
  kept: string
}

/** Les récupérations faites depuis le démarrage, pour en prévenir l'utilisateur. */
export const recoveries: Recovery[] = []

// Une récupération par fichier à la fois : les lectures et écritures de ce fichier l'attendent.
const recovering = new Map<string, Promise<unknown>>()

/**
 * Un fichier illisible (JSON abîmé : coupure, disque plein…) est mis de côté sous un autre nom, jamais
 * effacé, et remplacé par sa dernière sauvegarde lisible ; sans sauvegarde, on repart de zéro.
 */
async function recover(file: string): Promise<unknown> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const kept = `${file}.abime-${stamp}`
  await rename(file, kept)
  for (const day of await backupDays(backupsDir(file))) {
    try {
      const text = await readFile(path.join(backupsDir(file), day, path.basename(file)), 'utf8')
      const data: unknown = JSON.parse(text)
      await writeAtomic(file, text)
      recoveries.push({ file: path.basename(file), backup: day, kept: path.basename(kept) })
      return data
    } catch {
      // Absente ou abîmée elle aussi dans cette sauvegarde : on essaie la précédente.
    }
  }
  recoveries.push({ file: path.basename(file), backup: null, kept: path.basename(kept) })
  return undefined
}

/** Lit un fichier JSON ; `fallback` s'il n'existe pas encore. Abîmé, il est récupéré (voir `recover`). */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  await recovering.get(file)
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw error
  }
  try {
    return JSON.parse(text) as T
  } catch {
    let task = recovering.get(file)
    if (!task) {
      task = recover(file).finally(() => recovering.delete(file))
      recovering.set(file, task)
    }
    return ((await task) ?? fallback) as T
  }
}

// Les mises à jour (tous fichiers confondus) s'enchaînent une par une : jamais deux écritures en même temps.
let queue: Promise<unknown> = Promise.resolve()

/** Exécute `task` dans la file des écritures : aucune autre écriture ne se fait pendant ce temps. */
export function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task)
  queue = run.catch(() => undefined)
  return run
}

/** Relit le fichier, applique `change`, puis réécrit le résultat d'un coup ; renvoie les nouvelles données. */
export function updateJson<T>(file: string, fallback: T, change: (current: T) => T): Promise<T> {
  return exclusive(async () => {
    const next = change(await readJson(file, fallback))
    await writeAtomic(file, JSON.stringify(next, null, 2) + '\n')
    return next
  })
}
