import { chordShape, type Frets } from './chords.ts'
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
  const { id, name, chords, bpm, notes, shapes, rhythm, updatedAt } = value as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return false
  if (updatedAt !== undefined && (typeof updatedAt !== 'string' || updatedAt.length > 40)) return false
  if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return false
  if (typeof notes !== 'string' || notes.length > MAX_PROGRESSION_NOTES) return false
  // Au moins un accord : la lecture d'une suite vide n'aurait rien à jouer.
  if (!Array.isArray(chords) || chords.length === 0 || chords.length > MAX_CHORDS) return false
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
  return chordTokens(text)
    .slice(0, MAX_CHORDS)
    .map((chord) => chord.slice(0, MAX_CHORD_LENGTH))
}

const SEPARATOR = /(\s+[-–—]\s+|[\s,;|]+)/

/** Les accords tapés, tels quels : sans la limite en nombre ni en longueur (voir `splitChords`). */
export function chordTokens(text: string): string[] {
  return text.split(SEPARATOR).filter((part, index) => index % 2 === 0 && part !== '')
}

/** Renomme un accord dans la saisie, partout où il est, sans toucher aux séparateurs (« Am | F, C »). */
export function renameChord(text: string, from: string, to: string): string {
  return text
    .split(SEPARATOR)
    .map((part, index) => (index % 2 === 0 && part.slice(0, MAX_CHORD_LENGTH) === from ? to : part))
    .join('')
}

/** « % » : le même accord que le précédent, comme dans une grille. */
export const isSameChord = (chord: string) => chord === '%'
/** « N.C. » (no chord) : une mesure sans accord. */
export const isNoChord = (chord: string) => /^n\.?c\.?$/i.test(chord)
/** « x2 », « ×4 » : une marque de reprise, qui n'est pas un accord. */
export const isRepeatMark = (chord: string) => /^[x×]\d+$/i.test(chord)

/**
 * Ce qu'on joue, mesure après mesure : « % » reprend l'accord précédent, les marques de reprise sont
 * sautées, « N.C. » reste (une mesure sans accord). Jamais vide : au pire, une mesure sans accord.
 */
export function playedChords(chords: string[]): string[] {
  const played: string[] = []
  for (const chord of chords) {
    if (isRepeatMark(chord)) continue
    played.push(isSameChord(chord) ? (played.at(-1) ?? 'N.C.') : chord)
  }
  return played.length > 0 ? played : ['N.C.']
}

const sameFrets = (a: Frets | null, b: Frets) => a !== null && a.every((fret, string) => fret === b[string])

/**
 * Nom d'une position dans la suite : le nom choisi, sauf si la suite a déjà ce même accord dans une autre
 * position ; alors « C(2) », « C(3) »… : chaque nom n'a qu'un diagramme.
 */
export function variantName(name: string, frets: Frets, chords: string[], shapes: Record<string, Frets>): string {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : `(${n})`
    const candidate = name.slice(0, MAX_CHORD_LENGTH - suffix.length) + suffix
    const shown = shapes[candidate] ?? chordShape(candidate)?.frets ?? null
    if (!chords.includes(candidate) || sameFrets(shown, frets)) return candidate
  }
}
