import { describe, expect, it } from 'vitest'
import { chordShape, detectChord, drawnShape, firstFret, fretsName, parseChord } from './chords.ts'
import { chordTokens, countLabel, isRhythm, playedChords, renameChord, resizeRhythm, splitChords, variantName } from './progressions.ts'

describe('parseChord', () => {
  it('lit la notation anglaise et française', () => {
    expect(parseChord('Am')).toEqual({ root: 9, quality: 'm' })
    expect(parseChord('Lam')).toEqual({ root: 9, quality: 'm' })
    expect(parseChord('F#7')).toEqual({ root: 6, quality: '7' })
    expect(parseChord('Sib')).toEqual({ root: 10, quality: '' })
    expect(parseChord('Bbmaj7')).toEqual({ root: 10, quality: 'maj7' })
    expect(parseChord('Ré')).toEqual({ root: 2, quality: '' })
    expect(parseChord('C/G')).toEqual({ root: 0, quality: '' })
    expect(parseChord('Am(2)')).toEqual({ root: 9, quality: 'm' })
  })

  it('lit les minuscules, les parenthèses et les autres écritures courantes', () => {
    expect(parseChord('am')).toEqual({ root: 9, quality: 'm' })
    expect(parseChord('bb')).toEqual({ root: 10, quality: '' })
    expect(parseChord('(Am)')).toEqual({ root: 9, quality: 'm' })
    expect(parseChord('CMaj7')).toEqual({ root: 0, quality: 'maj7' })
    expect(parseChord('CM')).toEqual({ root: 0, quality: '' })
    expect(parseChord('Bø')).toEqual({ root: 11, quality: 'm7b5' })
    expect(parseChord('C6/9')).toEqual({ root: 0, quality: '69' })
    expect(parseChord('A2')).toEqual({ root: 9, quality: 'add9' })
    // « Fa » + « ug » n'existe pas : c'est F augmenté.
    expect(parseChord('Faug')).toEqual({ root: 5, quality: 'aug' })
    expect(parseChord('Fa7')).toEqual({ root: 5, quality: '7' })
  })

  it('refuse ce qui n\'est pas un accord', () => {
    expect(parseChord('H')).toBeNull()
    expect(parseChord('Cxyz')).toBeNull()
    expect(parseChord('x2')).toBeNull()
    expect(parseChord('%')).toBeNull()
  })
})

describe('chordShape', () => {
  it('donne les positions ouvertes habituelles', () => {
    expect(chordShape('C')).toEqual({ frets: [null, 3, 2, 0, 1, 0] })
    expect(chordShape('Am')).toEqual({ frets: [null, 0, 2, 2, 1, 0] })
    expect(chordShape('E')).toEqual({ frets: [0, 2, 2, 1, 0, 0] })
    expect(chordShape('G')).toEqual({ frets: [3, 2, 0, 0, 0, 3] })
  })

  it('déplace les formes barrées, au plus près du sillet', () => {
    expect(chordShape('F')).toEqual({ frets: [1, 3, 3, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } })
    expect(chordShape('Bm')).toEqual({ frets: [null, 2, 4, 4, 3, 2], barre: { fret: 2, from: 1, to: 5 } })
    expect(chordShape('Fa#m')?.frets).toEqual([2, 4, 4, 2, 2, 2])
  })

  it('renvoie null pour un accord inconnu', () => {
    expect(chordShape('Xm')).toBeNull()
  })

  it("ne dessine pas de barré sur une corde étouffée ou tenue plus bas", () => {
    expect(chordShape('F#maj7')).toEqual({ frets: [2, null, 3, 3, 2, null] })
    expect(chordShape('E7#9')?.barre).toBeUndefined()
    expect(chordShape('Fmaj7')).toEqual({ frets: [null, null, 3, 2, 1, 0] })
  })

  it('donne à chaque couleur, sur chaque note, une position reconnue et près du sillet', () => {
    const roots = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    const qualities = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'dim', 'aug', '5', '6', 'm6', 'add9', '9', 'm7b5', 'dim7', '7sus4', 'm9', 'maj9', '6/9', '7#9']
    for (const root of roots) {
      for (const quality of qualities) {
        const shape = chordShape(root + quality)
        expect(shape, root + quality).not.toBeNull()
        const detected = detectChord(shape!.frets)
        expect(detected && chordShape(detected.replace(/\/[A-G][#b]?$/, ''))?.frets, root + quality).toEqual(shape!.frets)
        expect(Math.min(...shape!.frets.filter((f): f is number => f !== null)), root + quality).toBeLessThan(10)
      }
    }
  })
})

describe('splitChords', () => {
  it('sépare sur les espaces, virgules, barres et tirets isolés', () => {
    expect(splitChords('Am F, C | G - Em  A-')).toEqual(['Am', 'F', 'C', 'G', 'Em', 'A-'])
  })
})

describe('drawnShape', () => {
  it('reconnaît un barré dessiné à la main', () => {
    expect(drawnShape([3, 5, 5, 4, 3, 3])).toEqual({ frets: [3, 5, 5, 4, 3, 3], barre: { fret: 3, from: 0, to: 5 } })
  })

  it('ne voit pas de barré dans un accord ouvert', () => {
    expect(drawnShape([null, 3, 2, 0, 1, 0]).barre).toBeUndefined()
    expect(drawnShape([null, null, 0, 2, 3, 2]).barre).toBeUndefined()
  })
})

describe('firstFret', () => {
  it('part du sillet, ou de la case la plus basse quand l\'accord est haut', () => {
    expect(firstFret([null, 3, 2, 0, 1, 0])).toBe(1)
    expect(firstFret([null, 7, 9, 9, 8, 7])).toBe(7)
  })
})

describe('detectChord', () => {
  it('reconnaît les accords courants', () => {
    expect(detectChord([null, 3, 2, 0, 1, 0])).toBe('C')
    expect(detectChord([null, 0, 2, 2, 1, 0])).toBe('Am')
    expect(detectChord([3, 2, 0, 0, 0, 3])).toBe('G')
    expect(detectChord([0, 2, 2, 0, 0, 0])).toBe('Em')
    expect(detectChord([null, null, 0, 2, 1, 2])).toBe('D7')
    expect(detectChord([1, 3, 3, 2, 1, 1])).toBe('F')
    expect(detectChord([null, 3, 5, 3, 5, 3])).toBe('C7')
    expect(detectChord([null, 2, 4, 4, 3, 2])).toBe('Bm')
  })

  it('écrit la basse quand ce n\'est pas la fondamentale', () => {
    expect(detectChord([3, 3, 2, 0, 1, 0])).toBe('C/G')
  })

  it('tolère une quinte absente', () => {
    expect(detectChord([null, 3, 2, 3, null, null])).toBe('C7')
  })

  it('renvoie null quand les notes ne forment pas un accord connu', () => {
    expect(detectChord([null, null, null, null, null, 0])).toBeNull()
    expect(detectChord([0, 1, 2, 3, 4, 5])).toBeNull()
  })
})

describe('fretsName', () => {
  it('écrit les cases, avec des tirets au-delà de la 9e', () => {
    expect(fretsName([null, 3, 2, 0, 1, 0])).toBe('x32010')
    expect(fretsName([null, 10, 12, 12, 11, 10])).toBe('x-10-12-12-11-10')
  })
})

describe('rythmique', () => {
  it('garde chaque coup à sa place quand la mesure change', () => {
    const folk = { beats: 4, subdivision: 2, pattern: 'D-DU-UDU' }
    expect(resizeRhythm(folk, 4, 4).pattern).toBe('D---D-U---U-D-U-')
    expect(resizeRhythm(resizeRhythm(folk, 4, 4), 4, 2)).toEqual(folk)
    expect(resizeRhythm(folk, 3, 2).pattern).toBe('D-DU-U')
    expect(resizeRhythm(folk, 6, 2).pattern).toBe('D-DU-UDU----')
  })

  it('valide une rythmique', () => {
    expect(isRhythm({ beats: 4, subdivision: 2, pattern: 'D-DU-UDU' })).toBe(true)
    expect(isRhythm({ beats: 4, subdivision: 2, pattern: 'D-DU' })).toBe(false)
    expect(isRhythm({ beats: 5, subdivision: 2, pattern: 'D-DU-UDU--' })).toBe(false)
    expect(isRhythm({ beats: 4, subdivision: 2, pattern: 'D-DU-UDZ' })).toBe(false)
  })

  it('compte les coups', () => {
    expect([0, 1, 2, 3].map((i) => countLabel(i, 2))).toEqual(['1', '&', '2', '&'])
    expect([0, 1, 2, 3, 4].map((i) => countLabel(i, 4))).toEqual(['1', 'e', '&', 'a', '2'])
  })
})

describe('variantName', () => {
  const barre = [null, 3, 5, 5, 5, 3]
  it("garde le nom quand la suite n'a pas déjà cet accord, ou dans la même position", () => {
    expect(variantName('C', barre, ['Am', 'F'], {})).toBe('C')
    expect(variantName('C', [null, 3, 2, 0, 1, 0], ['C', 'F'], {})).toBe('C')
    expect(variantName('C', barre, ['C(2)'], { 'C(2)': barre })).toBe('C')
  })

  it('numérote une autre position du même accord', () => {
    expect(variantName('C', barre, ['C', 'F'], {})).toBe('C(2)')
    expect(variantName('C', barre, ['C', 'C(2)'], { 'C(2)': [8, 10, 10, 9, 8, 8] })).toBe('C(3)')
    expect(variantName('C', barre, ['C', 'C(2)'], { 'C(2)': barre })).toBe('C(2)')
  })
})

describe('saisie des accords', () => {
  it('garde tous les accords tapés, au-delà des limites', () => {
    expect(chordTokens(' Am | F,C ').length).toBe(3)
    expect(chordTokens(Array(40).fill('C').join(' ')).length).toBe(40)
  })

  it('renomme un accord sans toucher aux séparateurs', () => {
    expect(renameChord('Am | F | C, F', 'F', 'Fmaj7')).toBe('Am | Fmaj7 | C, Fmaj7')
    expect(renameChord('Am F', 'A', 'B')).toBe('Am F')
  })

  it('joue « % », saute « x2 » et garde « N.C. »', () => {
    expect(playedChords(['Am', '%', 'F', 'x2', 'N.C.', 'G'])).toEqual(['Am', 'Am', 'F', 'N.C.', 'G'])
    expect(playedChords(['%', 'x2'])).toEqual(['N.C.'])
  })
})
