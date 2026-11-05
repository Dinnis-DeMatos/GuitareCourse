import { MAX_BPM, MIN_BPM } from './limits.ts'
import { fold } from './tabLibrary.ts'

// Les routines : une suite d'exercices minutés, pour reprendre son entraînement sans le réinventer.

export interface RoutineStep {
  /** L'exercice (« Gamme pentatonique de La »). */
  name: string
  /** Durée prévue, en minutes entières. */
  minutes: number
  /** Tempo joué au métronome pendant l'exercice ; absent : pas de métronome. */
  bpm?: number
  /** Ce qu'on veut se rappeler : tempo, doigté, leçon… */
  details: string
}

export interface Routine {
  id: string
  name: string
  /** Dans l'ordre où on les enchaîne. */
  steps: RoutineStep[]
  notes: string
  /** Date ISO du dernier enregistrement, posée par le serveur. */
  updatedAt?: string
}

// Limites partagées entre le navigateur et le serveur local.
export const MAX_ROUTINES = 100
export const MAX_ROUTINE_NAME = 80
export const MAX_STEPS = 30
export const MAX_STEP_NAME = 80
export const MAX_STEP_DETAILS = 200
export const MAX_STEP_MINUTES = 120
export const MAX_ROUTINE_NOTES = 2000

const isText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max

const isStep = (value: unknown) => {
  if (typeof value !== 'object' || value === null) return false
  const { name, minutes, details, bpm } = value as Record<string, unknown>
  if (bpm !== undefined && !(Number.isInteger(bpm) && (bpm as number) >= MIN_BPM && (bpm as number) <= MAX_BPM)) return false
  return (
    isText(name, MAX_STEP_NAME) &&
    isText(details, MAX_STEP_DETAILS) &&
    Number.isInteger(minutes) &&
    (minutes as number) >= 1 &&
    (minutes as number) <= MAX_STEP_MINUTES
  )
}

/** Une routine menée jusqu'au bout : ce qu'en garde le parcours, même si on la modifie ou la supprime ensuite. */
export interface RoutineRun {
  /** Date ISO, posée par le serveur. */
  date: string
  name: string
  minutes: number
}

/** Valide une routine terminée envoyée par le navigateur ({ name, minutes }) ; null si elle est incorrecte. */
export function parseRun(body: unknown): Omit<RoutineRun, 'date'> | null {
  if (typeof body !== 'object' || body === null) return null
  const { name, minutes } = body as Record<string, unknown>
  if (!isText(name, MAX_ROUTINE_NAME) || !Number.isInteger(minutes)) return null
  return (minutes as number) >= 1 && (minutes as number) <= MAX_STEPS * MAX_STEP_MINUTES ? { name: name as string, minutes: minutes as number } : null
}

/** Valide une routine (reçue du navigateur, ou relue du fichier). */
export function isRoutine(value: unknown): value is Routine {
  if (typeof value !== 'object' || value === null) return false
  const { id, name, steps, notes, updatedAt } = value as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return false
  if (updatedAt !== undefined && !isText(updatedAt, 40)) return false
  if (!isText(name, MAX_ROUTINE_NAME) || !isText(notes, MAX_ROUTINE_NOTES)) return false
  return Array.isArray(steps) && steps.length <= MAX_STEPS && steps.every(isStep)
}

/** « ♩ = 80 · aller-retour » : le tempo puis les détails d'un exercice. */
export const stepInfo = (step: RoutineStep) => [step.bpm && `♩ = ${step.bpm}`, step.details].filter(Boolean).join(' · ')

/** Durée totale de la routine, en minutes. */
export const totalMinutes = (routine: Routine) => routine.steps.reduce((sum, step) => sum + step.minutes, 0)

/** « 45 min », « 1 h », « 1 h 15 ». */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

/** Un temps restant en « 4:05 », arrondi à la seconde supérieure (on ne voit « 0:00 » qu'à la fin). */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Garde les routines dont le nom, un exercice ou la note contient chaque mot cherché (sans tenir compte des accents). */
export function filterRoutines(routines: Routine[], query: string): Routine[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return routines.filter((routine) => {
    const text = fold([routine.name, ...routine.steps.flatMap((s) => [s.name, s.details]), routine.notes].join(' '))
    return words.every((word) => text.includes(word))
  })
}
