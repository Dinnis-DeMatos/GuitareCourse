import { fold } from './tabLibrary.ts'

// Les sons : un réglage d'ampli et ses pédales, pour retrouver un son sans le rechercher.

export interface Knob {
  label: string
  /** De 0 à 10, par demi-cran. */
  value: number
}

export interface Pedal {
  name: string
  /** Ses réglages, tels qu'on les note (« Drive 6, Tone 5, Level 7 »). */
  settings: string
}

export interface Tone {
  id: string
  /** Le groupe ou l'artiste ; vide si on ne l'a pas indiqué. */
  artist: string
  /** Le titre du morceau. */
  name: string
  /** L'ampli (ou la simulation) ; vide si on ne l'a pas indiqué. */
  amp: string
  knobs: Knob[]
  /** Dans l'ordre de la chaîne, de la guitare vers l'ampli. */
  pedals: Pedal[]
  notes: string
  /** Date ISO du dernier enregistrement, posée par le serveur. */
  updatedAt?: string
}

// Limites partagées entre le navigateur et le serveur local.
export const MAX_TONES = 200
export const MAX_TONE_NAME = 80
export const MAX_KNOBS = 16
export const MAX_PEDALS = 16
export const MAX_LABEL = 40
export const MAX_SETTINGS = 200
export const MAX_TONE_NOTES = 2000
export const KNOB_MAX = 10

/**
 * Les boutons d'un ampli courant, proposés pour un nouveau son ; on les renomme ou les retire à volonté.
 * En anglais, comme sur la façade des amplis.
 */
export const DEFAULT_KNOBS: Knob[] = ['Gain', 'Bass', 'Middle', 'Treble', 'Presence', 'Volume', 'Reverb'].map((label) => ({
  label,
  value: 5,
}))

const isText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max

const isKnob = (value: unknown) => {
  if (typeof value !== 'object' || value === null) return false
  const { label, value: v } = value as Record<string, unknown>
  return isText(label, MAX_LABEL) && typeof v === 'number' && v >= 0 && v <= KNOB_MAX && Number.isInteger(v * 2)
}

const isPedal = (value: unknown) => {
  if (typeof value !== 'object' || value === null) return false
  const { name, settings } = value as Record<string, unknown>
  return isText(name, MAX_LABEL) && isText(settings, MAX_SETTINGS)
}

/** Valide un son (reçu du navigateur, ou relu du fichier). */
export function isTone(value: unknown): value is Tone {
  if (typeof value !== 'object' || value === null) return false
  const { id, artist, name, amp, knobs, pedals, notes, updatedAt } = value as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return false
  if (updatedAt !== undefined && !isText(updatedAt, 40)) return false
  if (!isText(artist, MAX_TONE_NAME) || !isText(name, MAX_TONE_NAME) || !isText(amp, MAX_TONE_NAME) || !isText(notes, MAX_TONE_NOTES)) return false
  if (!Array.isArray(knobs) || knobs.length > MAX_KNOBS || !knobs.every(isKnob)) return false
  return Array.isArray(pedals) && pedals.length <= MAX_PEDALS && pedals.every(isPedal)
}

/** Garde les sons dont l'artiste, le titre, l'ampli, une pédale ou la note contient chaque mot cherché (sans tenir compte des accents). */
export function filterTones(tones: Tone[], query: string): Tone[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return tones.filter((tone) => {
    const text = fold([tone.artist, tone.name, tone.amp, ...tone.pedals.map((p) => p.name), tone.notes].join(' '))
    return words.every((word) => text.includes(word))
  })
}
