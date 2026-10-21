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

  it('ne propose que des notes naturelles sans altérations, jamais deux fois de suite', () => {
    let previous = null
    for (let i = 0; i < 200; i++) {
      const target = randomTarget(previous, false)
      expect(NOTE_NAMES[target.pitchClass]).not.toContain('♯')
      expect(target).not.toEqual(previous)
      previous = target
    }
  })
})
