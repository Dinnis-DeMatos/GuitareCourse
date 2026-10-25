import type { model } from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { fixOpenStrings, roundTempos } from './score.ts'

function scoreWith(chord: { firstFret: number; strings: number[] }): model.Score {
  return { tracks: [{ staves: [{ chords: new Map([['Am', chord]]) }] }] } as unknown as model.Score
}

describe('fixOpenStrings', () => {
  it("rend sa corde à vide à un diagramme qui commence plus haut que la première case", () => {
    // Am(no5) en case 5, tel que lu par alphaTab : la corde de La à vide est devenue la case 4.
    const chord = { firstFret: 5, strings: [-1, -1, 5, 7, 4, -1] }
    fixOpenStrings(scoreWith(chord))
    expect(chord.strings).toEqual([-1, -1, 5, 7, 0, -1])
  })

  it('ne touche pas à un diagramme en première position', () => {
    const chord = { firstFret: 1, strings: [0, 1, 0, 2, 3, -1] }
    fixOpenStrings(scoreWith(chord))
    expect(chord.strings).toEqual([0, 1, 0, 2, 3, -1])
  })
})

describe('roundTempos', () => {
  it('arrondit chaque changement de tempo', () => {
    const score = {
      masterBars: [{ tempoAutomations: [{ value: 113 }] }, { tempoAutomations: [{ value: 88.2556 }] }],
    } as unknown as model.Score
    roundTempos(score)
    expect(score.masterBars.map((bar) => bar.tempoAutomations[0].value)).toEqual([113, 88])
  })
})
