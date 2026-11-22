import type { VideoProgress } from './courseTypes.ts'
import { dayKey } from './journal.ts'

/** Une vidéo vue à 95 % ou plus est considérée comme terminée (le générique de fin ne compte pas). */
export const COMPLETED_RATIO = 0.95

/** En dessous de ce seuil (secondes), on ne reprend pas : on repart du début. */
const MIN_RESUME_SECONDS = 5

/** Les jours de travail d'une vidéo ; avant qu'on les note, on les déduit de ses dates connues. */
export function practicedDays(entry: VideoProgress | undefined): string[] {
  if (!entry) return []
  if (entry.practicedOn) return entry.practicedOn
  const dates = entry.completed ? [entry.completedAt, entry.updatedAt] : entry.position > 0 ? [entry.updatedAt] : []
  return [...new Set(dates.filter((d) => d !== undefined).map((d) => dayKey(new Date(d))))]
}

/**
 * La progression après une mise à jour : la date où la vidéo a été terminée reste celle de la première
 * fois (pour le parcours), même si on la revoit ; elle disparaît si on la remet « à voir ».
 */
export function nextProgress(
  before: VideoProgress | undefined,
  update: Pick<VideoProgress, 'position' | 'duration' | 'completed'>,
  now: string,
): VideoProgress {
  const entry: VideoProgress = { ...update, updatedAt: now }
  if (update.completed) entry.completedAt = before?.completed ? (before.completedAt ?? before.updatedAt) : now
  const days = practicedDays(before)
  // On a travaillé si la lecture avance ou si la leçon vient d'être terminée, pas si on la remet « à voir ».
  const worked = update.position > (before?.position ?? 0) || (update.completed && !before?.completed)
  const today = dayKey(new Date(now))
  entry.practicedOn = worked && !days.includes(today) ? [...days, today] : days
  return entry
}

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
