import type { VideoProgress } from './courseTypes.ts'

/** Une vidéo vue à 95 % ou plus est considérée comme terminée (le générique de fin ne compte pas). */
export const COMPLETED_RATIO = 0.95

/** En dessous de ce seuil (secondes), on ne reprend pas : on repart du début. */
const MIN_RESUME_SECONDS = 5

export function isCompleted(position: number, duration: number): boolean {
  return duration > 0 && position / duration >= COMPLETED_RATIO
}

/** Position de reprise : 0 si la vidéo est terminée, jamais commencée ou à peine entamée. */
export function resumePosition(progress: VideoProgress | undefined): number {
  if (!progress || progress.completed || progress.position < MIN_RESUME_SECONDS) return 0
  return progress.position
}

export type LessonStatus = 'done' | 'started' | 'new'

/** État d'une leçon d'après sa progression : terminée, entamée ou pas commencée. */
export function statusOf(progress: VideoProgress | undefined): LessonStatus {
  if (progress?.completed) return 'done'
  return progress && progress.position > 0 ? 'started' : 'new'
}

export function formatTime(totalSeconds: number): string {
  // Une durée encore inconnue (NaN) s'affiche « 0:00 », pas « NaN:NaN ».
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
