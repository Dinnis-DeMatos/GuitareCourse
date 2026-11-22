import type { ProgressMap } from './courseTypes.ts'
import { dayKey } from './journal.ts'
import { practicedDays } from './progress.ts'

/** À envoyer sur `window` quand une séance vient d'être enregistrée. */
export const PRACTICE_EVENT = 'guitarecourse:practice'

/** Les formes de la mascotte, et le nombre de jours d'affilée qu'il faut pour chacune. */
export const STAGES = [
  { from: 0, name: 'En sommeil' },
  { from: 1, name: 'Éveillé' },
  { from: 3, name: 'Mélomane' },
  { from: 7, name: 'Gratteur' },
  { from: 14, name: 'Rockeur' },
  { from: 30, name: 'Sur scène' },
  { from: 60, name: 'Virtuose' },
  { from: 100, name: 'Légende' },
] as const

/**
 * Les jours d'affilée : leçons travaillées, plus les séances du manche et les routines terminées (`sessions`,
 * en dates ISO). Tant qu'aujourd'hui n'est pas fini, la série qui s'arrête hier tient encore.
 */
export function readStreak(progress: ProgressMap, sessions: string[], now: Date): { days: number; today: boolean } {
  const played = new Set([...Object.values(progress).flatMap(practicedDays), ...sessions.map((d) => dayKey(new Date(d)))])
  const today = played.has(dayKey(now))
  // À midi : un changement d'heure ne fait sauter aucun jour.
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (today ? 0 : 1), 12)
  let days = 0
  while (played.has(dayKey(day))) {
    days++
    day.setDate(day.getDate() - 1)
  }
  return { days, today }
}

export const stageIndex = (days: number) => STAGES.findLastIndex((stage) => days >= stage.from)
