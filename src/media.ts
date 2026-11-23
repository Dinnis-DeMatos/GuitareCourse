import type { CourseFile, LessonAnnotations, VideoProgress } from './courseTypes.ts'

/** URL d'un fichier du cours : chaque segment du chemin est encodé séparément. */
export function mediaUrl(file: CourseFile): string {
  return '/media/' + file.path.split('/').map(encodeURIComponent).join('/')
}

export type ProgressUpdate = Pick<VideoProgress, 'position' | 'duration' | 'completed'>

/** GET d'un JSON de l'API ; null en cas d'échec (on fait sans). */
export const readOrNull = <T,>(url: string): Promise<T | null> =>
  fetch(url).then((response) => (response.ok ? (response.json() as Promise<T>) : null)).catch(() => null)

/** PUT d'un corps JSON ; renvoie la réponse du serveur, rejette si c'est une erreur. */
export async function putJson<T = unknown>(url: string, body: unknown, keepalive = false): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive, // true : part même si la page se ferme
  })
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
  return response.json()
}

export async function putAnnotations(path: string, annotations: LessonAnnotations): Promise<void> {
  await putJson('/api/annotations', { path, ...annotations }, true)
}

export async function putFavorite(path: string, favorite: boolean): Promise<void> {
  await putJson('/api/favorites', { path, favorite })
}

export async function putProgress(path: string, update: ProgressUpdate): Promise<void> {
  await putJson('/api/progress', { path, ...update }, true)
}
