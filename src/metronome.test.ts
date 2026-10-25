import { describe, expect, it } from 'vitest'
import { MAX_BPM, MIN_BPM, clampBpm, tapTempo } from './metronome.ts'

describe('clampBpm', () => {
  it('arrondit et garde le tempo dans les bornes', () => {
    expect(clampBpm(92.4)).toBe(92)
    expect(clampBpm(5)).toBe(MIN_BPM)
    expect(clampBpm(900)).toBe(MAX_BPM)
  })
})

describe('tapTempo', () => {
  it('attend deux frappes', () => {
    expect(tapTempo([])).toBeNull()
    expect(tapTempo([1000])).toBeNull()
  })

  it('fait la moyenne des écarts entre frappes', () => {
    // 500 ms entre deux frappes : 120 bpm.
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120)
    expect(tapTempo([0, 480, 1000, 1500])).toBe(120)
  })

  it('ne garde que les quatre derniers écarts', () => {
    expect(tapTempo([0, 1000, 1500, 2000, 2500, 3000])).toBe(120)
  })

  it('recommence après une longue pause', () => {
    expect(tapTempo([0, 500, 5000])).toBeNull()
    expect(tapTempo([0, 500, 5000, 5600])).toBe(100)
  })
})
