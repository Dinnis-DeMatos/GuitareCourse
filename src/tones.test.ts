import { describe, expect, it } from 'vitest'
import { fromChain, isTone, toChain } from './tones.ts'

const a = { name: 'Overdrive', settings: '' }
const b = { name: 'Delay', settings: '' }
const tone = { id: 'x', artist: '', name: 'T', amp: '', knobs: [], pedals: [a, b], notes: '' }

describe('chaîne des pédales', () => {
  it("place l'ampli après toutes les pédales par défaut", () => {
    expect(toChain(tone)).toEqual([a, b, null])
  })

  it("retrouve les pédales et la place de l'ampli", () => {
    expect(toChain({ pedals: [a, b], ampAt: 1 })).toEqual([a, null, b])
    expect(fromChain([a, null, b])).toEqual({ pedals: [a, b], ampAt: 1 })
    expect(fromChain([null, b, a])).toEqual({ pedals: [b, a], ampAt: 0 })
  })

  it("refuse une place de l'ampli hors de la chaîne", () => {
    expect(isTone(tone)).toBe(true)
    expect(isTone({ ...tone, ampAt: 2 })).toBe(true)
    expect(isTone({ ...tone, ampAt: 3 })).toBe(false)
    expect(isTone({ ...tone, ampAt: -1 })).toBe(false)
    expect(isTone({ ...tone, ampAt: 0.5 })).toBe(false)
  })
})
