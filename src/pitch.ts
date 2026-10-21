// Exercice du manche : quelle note jouer, et quelle note est jouée (détection de hauteur au micro).

export const NOTE_NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']

/** Les six cordes en accordage standard, de la plus aiguë à la plus grave (ordre de la tablature). */
export const STRINGS = [
  { name: 'Mi aigu', midi: 64 },
  { name: 'Si', midi: 59 },
  { name: 'Sol', midi: 55 },
  { name: 'Ré', midi: 50 },
  { name: 'La', midi: 45 },
  { name: 'Mi grave', midi: 40 },
]

/** Cases proposées : de la corde à vide à la 12e. */
export const FRETS = 12

export interface Target {
  /** Indice dans STRINGS. */
  string: number
  /** Classe de hauteur, de 0 (Do) à 11 (Si). */
  pitchClass: number
}

export function pitchClassOf(midi: number): number {
  return ((midi % 12) + 12) % 12
}

/** Zone du manche travaillée : de la case `from` à la case `to`, incluses. */
export interface Zone {
  id: string
  label: string
  from: number
  to: number
}

/** Le manche entier, ou une position à la fois : c'est ainsi qu'on l'apprend. */
export const ZONES: Zone[] = [
  { id: 'all', label: 'Tout le manche', from: 0, to: FRETS },
  { id: 'low', label: 'Cases 0 à 5', from: 0, to: 5 },
  { id: 'mid', label: 'Cases 5 à 9', from: 5, to: 9 },
  { id: 'high', label: 'Cases 7 à 12', from: 7, to: FRETS },
]

/** Cases où se trouve une note sur une corde, dans la zone : une, ou deux à l'octave (cases 0 et 12). */
export function fretsOf(target: Target, zone: Zone = ZONES[0]): number[] {
  const first = pitchClassOf(target.pitchClass - STRINGS[target.string].midi)
  return [first, first + 12].filter((fret) => fret >= zone.from && fret <= zone.to)
}

/** Hauteurs exactes (notes MIDI) acceptées pour une consigne : la bonne note, à la bonne octave. */
export function targetMidis(target: Target, zone: Zone = ZONES[0]): number[] {
  return fretsOf(target, zone).map((fret) => STRINGS[target.string].midi + fret)
}

/** Clé d'une note dans le bilan de l'exercice (server/trainer.ts) : « corde-note ». */
export function noteKey(target: Target): string {
  return `${target.string}-${target.pitchClass}`
}

/**
 * Bilan d'une note : présentée `tries` fois, ratée `misses` fois ; trouvée `found` fois en `time`
 * millisecondes au total (temps de réponse). Les deux derniers manquent dans les bilans d'avant la 0.1.13.
 */
export type NoteStats = { tries: number; misses: number; found?: number; time?: number }
export type NoteStatsMap = Record<string, NoteStats>

/** Temps de réponse moyen d'une note, en millisecondes ; null si elle n'a jamais été trouvée en temps mesuré. */
export function averageTime(stats: NoteStats | undefined): number | null {
  return stats?.found ? (stats.time ?? 0) / stats.found : null
}

/**
 * Tire une note sur l'une des cordes choisies, dans la zone, différente de la précédente ; sans
 * altérations, seulement les notes naturelles. Plus une note a été ratée, plus elle revient : son poids
 * va de 1 à 7 selon son taux d'erreur (une note jamais vue compte comme ratée une fois sur deux).
 */
export function randomTarget(
  previous: Target | null,
  options: { sharps: boolean; strings: readonly number[]; zone?: Zone },
  stats: NoteStatsMap = {},
  random = Math.random,
): Target {
  const classes = options.sharps ? [...NOTE_NAMES.keys()] : [0, 2, 4, 5, 7, 9, 11]
  const strings = options.strings.length > 0 ? options.strings : [...STRINGS.keys()]
  const inZone = strings
    .flatMap((string) => classes.map((pitchClass) => ({ string, pitchClass })))
    .filter((t) => fretsOf(t, options.zone).length > 0)
  const others = inZone.filter((t) => t.string !== previous?.string || t.pitchClass !== previous.pitchClass)
  const candidates = others.length > 0 ? others : inZone
  const weights = candidates.map((t) => {
    const { tries = 0, misses = 0 } = stats[noteKey(t)] ?? {}
    return 1 + 6 * ((misses + 1) / (tries + 2))
  })
  let draw = random() * weights.reduce((a, b) => a + b, 0)
  for (const [i, weight] of weights.entries()) {
    draw -= weight
    if (draw < 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

/** Note MIDI la plus proche d'une fréquence (La 440 Hz = 69). */
export function midiOf(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440))
}

// Du Mi grave (82 Hz) un peu désaccordé jusqu'au-delà de la 12e case du Mi aigu (660 Hz).
const MIN_HZ = 70
const MAX_HZ = 1100
// En dessous, c'est le silence : le seuil ne descend jamais plus bas.
const MIN_RMS = 0.01
// Plus il est bas, plus la note doit être nette (périodique) pour compter : bruits et voix passent moins.
const THRESHOLD = 0.1
// Une note doit sonner nettement plus fort que le bruit de la pièce (environ 10 dB au-dessus).
const GATE_RATIO = 3

/** Niveau (valeur efficace) d'un extrait. */
export function rmsOf(samples: Float32Array): number {
  let energy = 0
  for (const sample of samples) energy += sample * sample
  return Math.sqrt(energy / samples.length)
}

/**
 * Seuil de bruit qui s'adapte à la pièce : tant qu'aucune note ne sonne, il suit le niveau ambiant
 * (lentement à la hausse, vite à la baisse), et seules les notes nettement plus fortes sont écoutées.
 */
export function createNoiseGate() {
  let floor = 0
  return {
    threshold: () => Math.max(MIN_RMS, floor * GATE_RATIO),
    /** À appeler à chaque extrait : `pitched` si une note y a été reconnue. */
    update(rms: number, pitched: boolean) {
      if (pitched) return
      floor += (rms - floor) * (rms > floor ? 0.02 : 0.1)
    },
  }
}

/**
 * Fréquence fondamentale d'un extrait (algorithme YIN), ou null s'il n'y a pas de note nette ou que
 * l'extrait est plus faible que `minRms`.
 * L'extrait doit couvrir au moins deux périodes de la note la plus grave : 2048 échantillons suffisent.
 */
export function detectPitch(samples: Float32Array, sampleRate: number, minRms = MIN_RMS): number | null {
  if (rmsOf(samples) < minRms) return null

  const minTau = Math.floor(sampleRate / MAX_HZ)
  const maxTau = Math.min(Math.floor(sampleRate / MIN_HZ), Math.floor(samples.length / 2))
  const width = samples.length - maxTau
  // Différence normalisée par sa moyenne cumulée : creuse vers 0 à chaque période.
  const d = new Float32Array(maxTau + 1)
  d[0] = 1
  let sum = 0
  for (let tau = 1; tau <= maxTau; tau++) {
    let diff = 0
    for (let i = 0; i < width; i++) {
      const delta = samples[i] - samples[i + tau]
      diff += delta * delta
    }
    sum += diff
    d[tau] = sum > 0 ? (diff * tau) / sum : 1
  }

  for (let tau = minTau; tau < maxTau; tau++) {
    if (d[tau] >= THRESHOLD) continue
    while (tau + 1 < maxTau && d[tau + 1] < d[tau]) tau++
    // Interpolation parabolique autour du creux, pour une fréquence plus fine que l'échantillon.
    const [a, b, c] = [d[tau - 1], d[tau], d[tau + 1]]
    const shift = a + c - 2 * b !== 0 ? (a - c) / (2 * (a + c - 2 * b)) : 0
    return sampleRate / (tau + shift)
  }
  return null
}
