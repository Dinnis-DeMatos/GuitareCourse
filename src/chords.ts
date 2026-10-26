/**
 * Positions d'accords pour les diagrammes du carnet.
 *
 * Un accord s'écrit à l'anglaise (« Am », « F#7 », « Bbmaj7 ») ou à la française (« Lam », « Fa#7 »). Les
 * accords ouverts courants ont leur position habituelle ; les autres sont tirés de deux formes barrées
 * qu'on déplace sur le manche : celle de Mi (fondamentale sur la 6e corde) et celle de La (sur la 5e).
 */

/** Case de chaque corde, de la 6e (Mi grave) à la 1re (Mi aigu) ; null = corde non jouée, 0 = à vide. */
export type Frets = (number | null)[]

export interface ChordShape {
  frets: Frets
  /** Barré : la case, et les cordes qu'il couvre (indices dans `frets`). */
  barre?: { fret: number; from: number; to: number }
}

type Quality = '' | 'm' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | 'dim' | 'aug' | '5' | '6' | 'm6' | 'add9' | '9'

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SOLFEGE: Record<string, number> = { do: 0, ré: 2, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 }

// Toutes les façons courantes d'écrire chaque couleur d'accord.
const QUALITIES: Record<string, Quality> = {
  '': '', M: '', maj: '',
  m: 'm', min: 'm', '-': 'm',
  '7': '7',
  m7: 'm7', min7: 'm7', '-7': 'm7',
  maj7: 'maj7', M7: 'maj7', '7M': 'maj7', 'Δ': 'maj7',
  sus2: 'sus2', sus4: 'sus4', sus: 'sus4',
  dim: 'dim', '°': 'dim',
  aug: 'aug', '+': 'aug',
  '5': '5', '6': '6', m6: 'm6', add9: 'add9', '9': '9',
}

/** Fondamentale (0 = Do) et couleur de l'accord ; null si on ne le reconnaît pas. La basse (« C/G ») est ignorée. */
export function parseChord(name: string): { root: number; quality: Quality } | null {
  const match = /^(do|ré|re|mi|fa|sol|la|si|[A-G])([#♯b♭]?)(.*)$/i.exec(name.split('/')[0].trim())
  if (!match) return null
  const [, note, accidental, rest] = match
  const base = note.length === 1 ? LETTERS[note.toUpperCase()] : SOLFEGE[note.toLowerCase()]
  // « b » seul après une lettre minuscule serait ambigu : seules les majuscules désignent une note anglaise.
  if (note.length === 1 && note !== note.toUpperCase()) return null
  const quality = QUALITIES[rest]
  if (quality === undefined) return null
  const shift = accidental === '#' || accidental === '♯' ? 1 : accidental ? -1 : 0
  return { root: (base + shift + 12) % 12, quality }
}

/** Positions ouvertes habituelles, que les formes barrées ne donnent pas. Indexées « fondamentale:couleur ». */
const OPEN: Record<string, Frets> = {
  '0:': [null, 3, 2, 0, 1, 0],
  '0:7': [null, 3, 2, 3, 1, 0],
  '0:maj7': [null, 3, 2, 0, 0, 0],
  '0:add9': [null, 3, 2, 0, 3, 0],
  '0:sus4': [null, 3, 3, 0, 1, 1],
  '2:': [null, null, 0, 2, 3, 2],
  '2:m': [null, null, 0, 2, 3, 1],
  '2:7': [null, null, 0, 2, 1, 2],
  '2:m7': [null, null, 0, 2, 1, 1],
  '2:maj7': [null, null, 0, 2, 2, 2],
  '2:sus2': [null, null, 0, 2, 3, 0],
  '2:sus4': [null, null, 0, 2, 3, 3],
  '4:maj7': [0, 2, 1, 1, 0, 0],
  '7:': [3, 2, 0, 0, 0, 3],
  '7:7': [3, 2, 0, 0, 0, 1],
  '7:maj7': [3, 2, 0, 0, 0, 2],
  '11:7': [null, 2, 1, 2, 0, 2],
}

/** Formes barrées, en cases relatives à la fondamentale. Forme de Mi : fondamentale sur la 6e corde (Mi = 4). */
const E_SHAPES: Partial<Record<Quality, Frets>> = {
  '': [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, null, 1, 1, 0, null],
  sus4: [0, 2, 2, 2, 0, 0],
  '5': [0, 2, 2, null, null, null],
}

/** Forme de La : fondamentale sur la 5e corde (La = 9). */
const A_SHAPES: Partial<Record<Quality, Frets>> = {
  '': [null, 0, 2, 2, 2, 0],
  m: [null, 0, 2, 2, 1, 0],
  '7': [null, 0, 2, 0, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  sus4: [null, 0, 2, 2, 3, 0],
  dim: [null, 0, 1, 2, 1, null],
  aug: [null, 0, 3, 2, 2, 1],
  '5': [null, 0, 2, 2, null, null],
  '6': [null, 0, 2, 2, 2, 2],
  m6: [null, 0, 2, 2, 1, 2],
  add9: [null, 0, 2, 4, 2, 0],
  '9': [null, 0, 2, 4, 2, 3],
}

function moved(shape: Frets, fret: number): ChordShape {
  const frets = shape.map((f) => (f === null ? null : f + fret))
  if (fret === 0) return { frets }
  // Le barré couvre les cordes jouées à la case de la fondamentale, de la première à la dernière.
  const atRoot = shape.flatMap((f, string) => (f === 0 ? [string] : []))
  return { frets, barre: { fret, from: atRoot[0], to: atRoot[atRoot.length - 1] } }
}

/** Hauteur de chaque corde à vide (0 = Do), de la 6e à la 1re : accordage standard. */
const TUNING = [4, 9, 2, 7, 11, 4]
const ROOT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

// Intervalles de chaque couleur, de la plus courante à la plus rare : en cas d'égalité, la première l'emporte.
const INTERVALS: [Quality, number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['7', [0, 4, 7, 10]],
  ['m7', [0, 3, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['add9', [0, 2, 4, 7]],
  ['9', [0, 2, 4, 7, 10]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['5', [0, 7]],
]

/**
 * Nom de l'accord qu'on a dessiné : on cherche une fondamentale dont les intervalles forment un accord
 * connu, la basse d'abord, puis en tolérant une quinte absente (très courant à la guitare). Une autre
 * basse que la fondamentale s'écrit « C/G ». null si les notes ne forment aucun accord connu.
 */
export function detectChord(frets: Frets): string | null {
  const notes = frets.flatMap((fret, string) => (fret === null ? [] : [(TUNING[string] + fret) % 12]))
  const pitches = [...new Set(notes)]
  if (pitches.length < 2) return null
  const bass = notes[0]
  const roots = [bass, ...pitches.filter((p) => p !== bass)]
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((n) => b.includes(n))
  // Sans quinte, il faut au moins trois notes : deux ne suffisent pas à dire de quel accord il s'agit.
  for (const withoutFifth of pitches.length >= 3 ? [false, true] : [false]) {
    for (const root of roots) {
      const intervals = pitches.map((p) => (p - root + 12) % 12)
      const found = INTERVALS.find(([, template]) =>
        same(intervals, withoutFifth ? template.filter((i) => i !== 7) : template),
      )
      if (found) {
        const name = ROOT_NAMES[root] + found[0]
        return root === bass ? name : `${name}/${ROOT_NAMES[bass]}`
      }
    }
  }
  return null
}

/** Nom d'un accord non reconnu : ses cases, comme on les écrit entre guitaristes (« x32010 »). */
export function fretsName(frets: Frets): string {
  const marks = frets.map((f) => (f === null ? 'x' : String(f)))
  return marks.some((m) => m.length > 1) ? marks.join('-') : marks.join('')
}

/** Nombre de cases montrées par un diagramme. */
export const SHOWN_FRETS = 4

/** Première case montrée : le sillet si l'accord y tient, sinon sa case la plus basse. */
export function firstFret(frets: Frets): number {
  const played = frets.filter((f): f is number => f !== null && f > 0)
  return played.length === 0 || Math.max(...played) <= SHOWN_FRETS ? 1 : Math.min(...played)
}

/**
 * Position dessinée à la main. Un barré y est reconnu quand la case la plus basse est tenue sur au moins
 * trois cordes et que les cordes entre elles sont toutes appuyées : un doigt couché suffit alors.
 */
export function drawnShape(frets: Frets): ChordShape {
  const played = frets.filter((f): f is number => f !== null && f > 0)
  if (played.length === 0) return { frets }
  const fret = Math.min(...played)
  const strings = frets.flatMap((f, string) => (f === fret ? [string] : []))
  const from = strings[0]
  const to = strings[strings.length - 1]
  const covered = frets.slice(from, to + 1).every((f) => f !== null && f >= fret)
  return strings.length >= 3 && covered ? { frets, barre: { fret, from, to } } : { frets }
}

/** Position d'un accord : la position ouverte si elle existe, sinon la forme barrée la plus proche du sillet. */
export function chordShape(name: string): ChordShape | null {
  const chord = parseChord(name)
  if (!chord) return null
  const open = OPEN[`${chord.root}:${chord.quality}`]
  if (open) return { frets: open }
  const candidates: ChordShape[] = []
  const e = E_SHAPES[chord.quality]
  const a = A_SHAPES[chord.quality]
  if (e) candidates.push(moved(e, (chord.root - 4 + 12) % 12))
  if (a) candidates.push(moved(a, (chord.root - 9 + 12) % 12))
  const lowest = (shape: ChordShape) => Math.min(...shape.frets.filter((f) => f !== null))
  return candidates.sort((x, y) => lowest(x) - lowest(y))[0] ?? null
}
