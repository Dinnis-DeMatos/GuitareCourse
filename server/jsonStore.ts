import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Lit un fichier JSON ; `fallback` s'il n'existe pas encore. Toute autre erreur (JSON abîmé…) remonte. */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw error
  }
}

// Les mises à jour (tous fichiers confondus) s'enchaînent une par une : jamais deux écritures en même temps.
let queue: Promise<unknown> = Promise.resolve()

/** Relit le fichier, applique `change`, puis réécrit le résultat d'un coup ; renvoie les nouvelles données. */
export function updateJson<T>(file: string, fallback: T, change: (current: T) => T): Promise<T> {
  const task = queue.then(async () => {
    const next = change(await readJson(file, fallback))
    await mkdir(path.dirname(file), { recursive: true })
    // Écriture dans un fichier temporaire puis renommage : jamais de fichier à moitié écrit.
    const temporary = `${file}.tmp`
    await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', 'utf8')
    await rename(temporary, file)
    return next
  })
  queue = task.catch(() => undefined)
  return task
}
