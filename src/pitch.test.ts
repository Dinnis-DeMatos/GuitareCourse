import { describe, expect, it } from 'vitest'
import { detectPitch, fretsOf, midiOf, NOTE_NAMES, pitchClassOf, randomTarget, STRINGS } from './pitch.ts'

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
