import type { ChordProgression, Rhythm } from './courseTypes.ts'
import { BEATS, MAX_BPM, MIN_BPM } from './limits.ts'

// Limites partagées entre le navigateur et le serveur local.
export const MAX_PROGRESSIONS = 200
export const MAX_CHORDS = 32
export const MAX_CHORD_LENGTH = 20
export const MAX_NAME_LENGTH = 80
export const MAX_PROGRESSION_NOTES = 2000
export const MAX_FRET = 24

/** Valide une suite d'accords (reçue du navigateur, ou relue du fichier). */
export function isProgression(value: unknown): value is ChordProgression {
  if (typeof value !== 'object' || value === null) return false
  const { id, name, chords, bpm, notes, shapes, rhythm } = value as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return false
  if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return false
  if (typeof notes !== 'string' || notes.length > MAX_PROGRESSION_NOTES) return false
  if (!Array.isArray(chords) || chords.length > MAX_CHORDS) return false
  if (!chords.every((c) => typeof c === 'string' && c !== '' && c.length <= MAX_CHORD_LENGTH)) return false
  if (shapes !== undefined && !isShapes(shapes)) return false
  if (rhythm !== undefined && !isRhythm(rhythm)) return false
  return bpm === undefined || (Number.isInteger(bpm) && (bpm as number) >= MIN_BPM && (bpm as number) <= MAX_BPM)
}

const isFret = (fret: unknown) => fret === null || (Number.isInteger(fret) && (fret as number) >= 0 && (fret as number) <= MAX_FRET)

function isShapes(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value)
  if (entries.length > MAX_CHORDS) return false
  return entries.every(
    ([name, frets]) => name !== '' && name.length <= MAX_CHORD_LENGTH && Array.isArray(frets) && frets.length === 6 && frets.every(isFret),
  )
}

/** Coups d'une rythmique : vers le bas, vers le haut, étouffé, silence. */
export const STROKES = ['D', 'U', 'X', '-'] as const
/** Croches (2 coups par temps) ou doubles croches (4). */
export const SUBDIVISIONS = [2, 4] as const

/** La rythmique proposée quand on en ajoute une : la plus courante en folk (bas, bas-haut, haut-bas-haut). */
export const DEFAULT_RHYTHM: Rhythm = { beats: 4, subdivision: 2, pattern: 'D-DU-UDU' }

export function isRhythm(value: unknown): value is Rhythm {
  if (typeof value !== 'object' || value === null) return false
  const { beats, subdivision, pattern } = value as Record<string, unknown>
  if (!BEATS.some((b) => b === beats) || !SUBDIVISIONS.some((s) => s === subdivision)) return false
  return typeof pattern === 'string' && pattern.length === (beats as number) * (subdivision as number) && /^[DUX-]*$/.test(pattern)
}

/**
 * Change la mesure d'une rythmique en gardant chaque coup à sa place dans le temps : en passant aux
 * croches, les coups des doubles croches qui tombent entre deux croches sont perdus.
 */
export function resizeRhythm(rhythm: Rhythm, beats: number, subdivision: number): Rhythm {
  let pattern = ''
  for (let beat = 0; beat < beats; beat++) {
    for (let step = 0; step < subdivision; step++) {
      const old = (step * rhythm.subdivision) / subdivision
      pattern += beat < rhythm.beats && Number.isInteger(old) ? rhythm.pattern[beat * rhythm.subdivision + old] : '-'
    }
  }
  return { beats, subdivision, pattern }
}

/** Comment on compte chaque coup : « 1 & 2 & » en croches, « 1 e & a » en doubles croches. */
export function countLabel(index: number, subdivision: number): string {
  const step = index % subdivision
  if (step === 0) return String(index / subdivision + 1)
  return subdivision === 2 ? '&' : ['', 'e', '&', 'a'][step]
}

/**
 * Découpe la saisie « Am F C G » en accords. Espaces, virgules, barres de mesure et tirets entourés
 * d'espaces séparent ; un tiret collé (« A- ») reste un accord mineur.
 */
export function splitChords(text: string): string[] {
  return text
    .split(/\s+[-–—]\s+|[\s,;|]+/)
    .filter((chord) => chord !== '')
    .slice(0, MAX_CHORDS)
    .map((chord) => chord.slice(0, MAX_CHORD_LENGTH))
}
