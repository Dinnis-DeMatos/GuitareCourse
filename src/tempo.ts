// Range les backing tracks d'une leçon : un même morceau fourni à plusieurs tempos devient une
// « échelle de tempos » (80 · 90 · 110… bpm) au lieu d'une liste de fichiers presque identiques.

import type { CourseFile } from './courseTypes.ts'

export interface TempoTrack {
  bpm: number
  file: CourseFile
}

/** Un même morceau à plusieurs tempos, du plus lent au plus rapide. */
export interface TempoLadder {
  kind: 'ladder'
  title: string
  tracks: TempoTrack[]
}

export interface SingleTrack {
  kind: 'single'
  title: string
  bpm: number | null
  file: CourseFile
}

export type BackingItem = TempoLadder | SingleTrack

const TEMPO = /(\d{2,3})\s*bpm/i

/** Tempo indiqué dans un titre (« … 110 bpm », « …70BPM ») et titre sans ce tempo. */
export function parseTempo(title: string): { bpm: number; base: string } | null {
  const match = TEMPO.exec(title)
  if (!match) return null
  const bpm = Number(match[1])
  if (bpm < 30 || bpm > 300) return null
  const before = title.slice(0, match.index)
  // Un reste d'extension collé au tempo (« 70BPMwav ») ne fait pas partie du titre.
  const after = title.slice(match.index + match[0].length).replace(/^(wav|mp3|flac|ogg|m4a)\b/i, '')
  const base = `${before} ${after}`
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-_.,;:]+|[\s\-_.,;:(]+$/g, '')
    .trim()
  return { bpm, base }
}

/** Titre réduit à ses lettres et chiffres, sans accents : sert à reconnaître deux fois le même morceau. */
function keyOf(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Nombre de caractères à changer pour passer d'un texte à l'autre (distance de Levenshtein). */
function distance(a: string, b: string): number {
  if (a === b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

/**
 * Deux titres désignent le même morceau s'ils ne diffèrent que d'une faute de frappe : au plus un
 * caractère sur cinq (« Full barres acon Red hot » = « Full barres facon des Red hot »). Des titres
 * courts doivent donc être identiques (« Exo A » ≠ « Exo B »).
 */
function sameTune(a: string, b: string): boolean {
  return distance(a, b) <= Math.floor(0.2 * Math.max(a.length, b.length))
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best = values[0] ?? ''
  for (const [value, count] of counts) if (count > (counts.get(best) ?? 0)) best = value
  return best
}

interface Draft {
  keys: string[]
  bases: string[]
  tracks: TempoTrack[]
}

/** Backing tracks d'une leçon, dans l'ordre des fichiers, les variantes de tempo regroupées. */
export function groupBackingTracks(files: CourseFile[]): BackingItem[] {
  const slots: (Draft | SingleTrack)[] = []

  for (const file of files) {
    const tempo = parseTempo(file.title)
    if (!tempo) {
      slots.push({ kind: 'single', title: file.title, bpm: null, file })
      continue
    }
    const key = keyOf(tempo.base)
    const draft = slots.find(
      (slot): slot is Draft =>
        'tracks' in slot &&
        // Deux fichiers au même tempo sont forcément deux morceaux différents.
        !slot.tracks.some((track) => track.bpm === tempo.bpm) &&
        slot.keys.some((known) => sameTune(known, key)),
    )
    if (draft) {
      draft.keys.push(key)
      draft.bases.push(tempo.base)
      draft.tracks.push({ bpm: tempo.bpm, file })
    } else {
      slots.push({ keys: [key], bases: [tempo.base], tracks: [{ bpm: tempo.bpm, file }] })
    }
  }

  return slots.map((slot): BackingItem => {
    if (!('tracks' in slot)) return slot
    const [only] = slot.tracks
    if (slot.tracks.length === 1) return { kind: 'single', title: only.file.title, bpm: only.bpm, file: only.file }
    return {
      kind: 'ladder',
      title: mostCommon(slot.bases) || 'Backing track',
      tracks: [...slot.tracks].sort((a, b) => a.bpm - b.bpm),
    }
  })
}
