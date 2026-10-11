import type { CourseFile, VideoProgress } from './courseTypes.ts'

/** URL d'un fichier du cours : chaque segment du chemin est encodé séparément. */
export function mediaUrl(file: CourseFile): string {
  return '/media/' + file.path.split('/').map(encodeURIComponent).join('/')
}

export function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} Go`
    : `${Math.max(1, Math.round(bytes / 1024 ** 2))} Mo`
}

export type ProgressUpdate = Pick<VideoProgress, 'position' | 'duration' | 'completed'>

export async function putFavorite(path: string, favorite: boolean): Promise<void> {
  const response = await fetch('/api/favorites', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, favorite }),
  })
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
}

export async function putProgress(path: string, update: ProgressUpdate): Promise<void> {
  const response = await fetch('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, ...update }),
    keepalive: true, // part même si la page se ferme
  })
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
}
