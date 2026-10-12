// Calculs de la portée qui sert de barre de lecture : positions, barres de mesure.

import { formatTime } from './progress.ts'

export function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Position d'un instant sur la portée, de 0 à 1 ; 0 tant que la durée est inconnue. */
export function ratioOf(time: number, duration: number): number {
  return duration > 0 && Number.isFinite(duration) ? clampRatio(time / duration) : 0
}

const STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

/** Écart entre deux barres de mesure, en secondes : jamais plus de 14 barres, quelle que soit la durée. */
export function barStep(duration: number): number {
  return STEPS.find((step) => duration / step <= 14) ?? STEPS[STEPS.length - 1]
}

export interface BarLine {
  time: number
  /** Numéro de la minute (« 3 »), ou instant (« 0:30 ») pour les vidéos courtes. */
  label: string
}

/** Barres de mesure à tracer : une par pas, sauf au tout début et collée à la fin. */
export function barLines(duration: number): BarLine[] {
  if (!(duration > 0) || !Number.isFinite(duration)) return []
  const step = barStep(duration)
  const lines: BarLine[] = []
  for (let time = step; time < duration * 0.985; time += step) {
    lines.push({ time, label: step % 60 === 0 ? String(time / 60) : formatTime(time) })
  }
  return lines
}
