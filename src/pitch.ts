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

/** Cases (0 à 12) où se trouve une note sur une corde : une ou deux, à l'octave. */
export function fretsOf(target: Target): number[] {
  const first = pitchClassOf(target.pitchClass - STRINGS[target.string].midi)
  return first + 12 <= FRETS ? [first, first + 12] : [first]
}

/** Tire une note au hasard, différente de la précédente ; sans altérations, seulement les notes naturelles. */
export function randomTarget(previous: Target | null, sharps: boolean, random = Math.random): Target {
  const classes = sharps ? [...NOTE_NAMES.keys()] : [0, 2, 4, 5, 7, 9, 11]
  for (;;) {
    const target = {
      string: Math.floor(random() * STRINGS.length),
      pitchClass: classes[Math.floor(random() * classes.length)],
    }
    if (target.string !== previous?.string || target.pitchClass !== previous.pitchClass) return target
  }
}

/** Note MIDI la plus proche d'une fréquence (La 440 Hz = 69). */
export function midiOf(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440))
}

// Du Mi grave (82 Hz) un peu désaccordé jusqu'au-delà de la 12e case du Mi aigu (660 Hz).
const MIN_HZ = 70
const MAX_HZ = 1100
// En dessous, c'est le silence ou le bruit de la pièce.
const MIN_RMS = 0.01
const THRESHOLD = 0.15

/**
 * Fréquence fondamentale d'un extrait (algorithme YIN), ou null s'il n'y a pas de note nette.
 * L'extrait doit couvrir au moins deux périodes de la note la plus grave : 2048 échantillons suffisent.
 */
export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  let energy = 0
  for (const sample of samples) energy += sample * sample
  if (Math.sqrt(energy / samples.length) < MIN_RMS) return null

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
