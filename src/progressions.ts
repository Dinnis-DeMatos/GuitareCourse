import { capoShape, type Frets } from './chords.ts'
import type { ChordProgression, Rhythm } from './courseTypes.ts'
import { BEATS, MAX_BPM, MIN_BPM } from './limits.ts'

// Limites partagées entre le navigateur et le serveur local.
export const MAX_PROGRESSIONS = 200
export const MAX_CHORDS = 32
export const MAX_CHORD_LENGTH = 20
export const MAX_NAME_LENGTH = 80
export const MAX_PROGRESSION_NOTES = 2000
export const MAX_FRET = 24
export const MAX_CAPO = 12
export const MAX_CHORD_BARS = 8

/** Valide une suite d'accords (reçue du navigateur, ou relue du fichier). */
export function isProgression(value: unknown): value is ChordProgression {
  if (typeof value !== 'object' || value === null) return false
  const { id, name, chords, bpm, notes, shapes, rhythm, capo, durations, updatedAt } = value as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return false
  if (updatedAt !== undefined && (typeof updatedAt !== 'string' || updatedAt.length > 40)) return false
  if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return false
  if (typeof notes !== 'string' || notes.length > MAX_PROGRESSION_NOTES) return false
  // Au moins un accord : la lecture d'une suite vide n'aurait rien à jouer.
  if (!Array.isArray(chords) || chords.length === 0 || chords.length > MAX_CHORDS) return false
  if (!chords.every((c) => typeof c === 'string' && c !== '' && c.length <= MAX_CHORD_LENGTH)) return false
  if (shapes !== undefined && !isShapes(shapes)) return false
  if (rhythm !== undefined && !isRhythm(rhythm)) return false
  if (capo !== undefined && !(Number.isInteger(capo) && (capo as number) >= 1 && (capo as number) <= MAX_CAPO)) return false
  if (durations !== undefined && !(Array.isArray(durations) && durations.length === chords.length && durations.every((d) => Number.isInteger(d) && d >= 1 && d <= MAX_CHORD_BARS))) return false
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

/** Renomme l'accord `at` de la saisie, lui seul, sans toucher aux séparateurs (« Am | F, C »). */
export function renameChord(text: string, at: number, to: string): string {
  let seen = -1
  return text
    .split(SEPARATOR)
    .map((part, index) => (index % 2 === 0 && part !== '' && ++seen === at ? to : part))
    .join('')
}

/** Déplace un accord dans la saisie : les accords changent de place, les séparateurs restent (« Am | F, C »). */
export function moveChord(text: string, from: number, to: number): string {
  const tokens = chordTokens(text)
  tokens.splice(to, 0, ...tokens.splice(from, 1))
  let next = 0
  return text
    .split(SEPARATOR)
    .map((part, index) => (index % 2 === 0 && part !== '' ? tokens[next++] : part))
    .join('')
}

/** Retire l'accord `index` de la saisie, avec le séparateur qui le suit (le précédent pour le dernier). */
export function removeChord(text: string, index: number): string {
  const parts = text.split(SEPARATOR)
  let seen = -1
  const at = parts.findIndex((part, i) => i % 2 === 0 && part !== '' && ++seen === index)
  parts.splice(at < parts.length - 1 ? at : Math.max(at - 1, 0), 2)
  return parts.join('')
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

/** La durée, en mesures, de chacun des `playedChords` (les marques de reprise sont sautées de même). */
export function playedDurations(chords: string[], durations?: number[]): number[] {
  const played = chords.flatMap((chord, index) => (isRepeatMark(chord) ? [] : [durations?.[index] ?? 1]))
  return played.length > 0 ? played : [1]
}

/** L'accord joué à la mesure `measure` (la suite tourne en boucle). */
export function chordAtMeasure(durations: number[], measure: number): number {
  let rest = measure % durations.reduce((sum, d) => sum + d, 0)
  return durations.findIndex((d) => (rest -= d) < 0)
}

/** La mesure où commence l'accord `index`. */
export const measureOfChord = (durations: number[], index: number) => durations.slice(0, index).reduce((sum, d) => sum + d, 0)

/**
 * Les durées après une saisie au clavier : un accord corrigé garde la sienne ; si le nombre d'accords
 * change, ceux d'avant et d'après l'endroit modifié gardent la leur, les nouveaux durent une mesure.
 */
export function realignDurations(before: string[], after: string[], durations: number[]): number[] {
  if (before.length === after.length) return durations
  const shortest = Math.min(before.length, after.length)
  let start = 0
  while (start < shortest && before[start] === after[start]) start++
  let end = 0
  while (end < shortest - start && before.at(-1 - end) === after.at(-1 - end)) end++
  return after.map((_, i) => {
    if (i < start) return durations[i] ?? 1
    return i >= after.length - end ? (durations[i - after.length + before.length] ?? 1) : 1
  })
}

const sameFrets = (a: Frets | null, b: Frets) => a !== null && a.every((fret, string) => fret === b[string])

/**
 * Nom d'une position dans la suite : le nom choisi, sauf si la suite a déjà ce même accord dans une autre
 * position ; alors « C(2) », « C(3) »… : chaque nom n'a qu'un diagramme.
 */
export function variantName(name: string, frets: Frets, chords: string[], shapes: Record<string, Frets>, capo = 0): string {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : `(${n})`
    const candidate = name.slice(0, MAX_CHORD_LENGTH - suffix.length) + suffix
    const shown = shapes[candidate] ?? capoShape(candidate, capo)?.frets ?? null
    if (!chords.includes(candidate) || sameFrets(shown, frets)) return candidate
  }
}
