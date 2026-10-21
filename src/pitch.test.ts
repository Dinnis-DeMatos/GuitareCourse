import { describe, expect, it } from 'vitest'
import {
  averageTime,
  createNoiseGate,
  detectPitch,
  fretsOf,
  midiOf,
  NOTE_NAMES,
  pitchClassOf,
  randomTarget,
  rmsOf,
  STRINGS,
  targetMidis,
  ZONES,
} from './pitch.ts'

const RATE = 48000

/** Une corde pincée grossièrement : fondamentale et harmoniques décroissantes. */
function pluck(frequency: number, length = 2048): Float32Array {
  const samples = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    for (let h = 1; h <= 6; h++) samples[i] += (0.3 / h) * Math.sin((2 * Math.PI * frequency * h * i) / RATE)
  }
  return samples
}

describe('detectPitch', () => {
  it.each([82.41, 110, 146.83, 196, 246.94, 329.63, 659.26])('reconnaît %f Hz', (frequency) => {
    const found = detectPitch(pluck(frequency), RATE)
    expect(found).not.toBeNull()
    expect(midiOf(found!)).toBe(midiOf(frequency))
  })

  it('ignore le silence', () => {
    expect(detectPitch(new Float32Array(2048), RATE)).toBeNull()
  })

  it('ignore un bruit sans hauteur', () => {
    let seed = 1
    const noise = new Float32Array(2048).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.4)
    expect(detectPitch(noise, RATE)).toBeNull()
  })
})

describe('createNoiseGate', () => {
  it('reste au plus bas dans une pièce calme', () => {
    const gate = createNoiseGate()
    for (let i = 0; i < 200; i++) gate.update(0.001, false)
    expect(gate.threshold()).toBe(0.01)
  })

  it('laisse passer une note jouée par-dessus le bruit de la pièce, pas le bruit seul', () => {
    let seed = 7
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.06
    const gate = createNoiseGate()
    // Comme la boucle d'écoute : un extrait par image, le seuil suit la pièce.
    const listen = (frame: Float32Array) => {
      const found = detectPitch(frame, RATE, gate.threshold())
      gate.update(rmsOf(frame), found !== null)
      return found
    }
    for (let i = 0; i < 120; i++) expect(listen(new Float32Array(2048).map(noise))).toBeNull()
    const note = pluck(110).map((s) => s + noise())
    expect(midiOf(listen(note)!)).toBe(45)
  })

  it('monte avec le bruit ambiant, sans bouger pendant une note, puis redescend', () => {
    const gate = createNoiseGate()
    for (let i = 0; i < 300; i++) gate.update(0.05, false)
    expect(gate.threshold()).toBeGreaterThan(0.1)
    const during = gate.threshold()
    for (let i = 0; i < 100; i++) gate.update(0.4, true)
    expect(gate.threshold()).toBe(during)
    for (let i = 0; i < 100; i++) gate.update(0.001, false)
    expect(gate.threshold()).toBe(0.01)
  })
})

describe('notes du manche', () => {
  it('nomme les notes', () => {
    expect(NOTE_NAMES[pitchClassOf(midiOf(440))]).toBe('La')
    expect(NOTE_NAMES[pitchClassOf(STRINGS[5].midi)]).toBe('Mi')
  })

  it('trouve les cases d’une note sur une corde', () => {
    // Sol sur la corde de La : 10e case seulement ; Mi sur le Mi grave : à vide et 12e.
    expect(fretsOf({ string: 4, pitchClass: 7 })).toEqual([10])
    expect(fretsOf({ string: 5, pitchClass: 4 })).toEqual([0, 12])
  })

  it('limite les cases à la zone, et demande l’octave exacte', () => {
    const [, low, mid, high] = ZONES
    // Mi sur le Mi grave : à vide (Mi 2) ou en 12e case (Mi 3), selon la zone.
    expect(fretsOf({ string: 5, pitchClass: 4 }, low)).toEqual([0])
    expect(fretsOf({ string: 5, pitchClass: 4 }, high)).toEqual([12])
    expect(targetMidis({ string: 5, pitchClass: 4 })).toEqual([40, 52])
    expect(targetMidis({ string: 5, pitchClass: 4 }, high)).toEqual([52])
    // Sol sur la corde de La (10e case) n'existe pas entre les cases 5 et 9.
    expect(fretsOf({ string: 4, pitchClass: 7 }, mid)).toEqual([])
  })

  it('ne tire que des notes présentes dans la zone', () => {
    for (let i = 0; i < 200; i++) {
      const target = randomTarget(null, { sharps: true, strings: [0, 4], zone: ZONES[2] })
      expect(fretsOf(target, ZONES[2]).length).toBe(1)
    }
  })

  it('calcule le temps de réponse moyen', () => {
    expect(averageTime({ tries: 3, misses: 1, found: 2, time: 5000 })).toBe(2500)
    expect(averageTime({ tries: 3, misses: 3 })).toBeNull()
  })

  it('ne propose que des notes naturelles des cordes choisies, jamais deux fois de suite', () => {
    let previous = null
    for (let i = 0; i < 200; i++) {
      const target = randomTarget(previous, { sharps: false, strings: [4, 5] })
      expect(NOTE_NAMES[target.pitchClass]).not.toContain('♯')
      expect([4, 5]).toContain(target.string)
      expect(target).not.toEqual(previous)
      previous = target
    }
  })

  it('repropose plus souvent les notes ratées', () => {
    const stats = { '5-0': { tries: 10, misses: 9 }, '5-2': { tries: 10, misses: 0 } }
    let hard = 0
    let easy = 0
    for (let i = 0; i < 2000; i++) {
      const target = randomTarget(null, { sharps: false, strings: [5] }, stats)
      if (target.pitchClass === 0) hard++
      if (target.pitchClass === 2) easy++
    }
    expect(hard).toBeGreaterThan(easy * 3)
  })
})
