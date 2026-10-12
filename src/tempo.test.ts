import { describe, expect, it } from 'vitest'
import type { CourseFile } from './courseTypes.ts'
import { groupBackingTracks, parseTempo } from './tempo.ts'

const audio = (title: string): CourseFile => ({ title, ext: 'wav', kind: 'audio', path: `x/${title}.wav`, size: 1 })

describe('parseTempo', () => {
  it('lit le tempo et rend le titre sans lui', () => {
    expect(parseTempo('Training Triangle magique 110 bpm')).toEqual({ bpm: 110, base: 'Training Triangle magique' })
    expect(parseTempo('BT etude de cas final tierces et octaves 100BPM')).toEqual({
      bpm: 100,
      base: 'BT etude de cas final tierces et octaves',
    })
  })

  it('ignore un reste d\'extension collé au tempo', () => {
    expect(parseTempo('Full barres facon Red hot ! 70BPMwav')).toEqual({ bpm: 70, base: 'Full barres facon Red hot !' })
  })

  it('ne voit pas de tempo là où il n\'y en a pas', () => {
    expect(parseTempo('BACKING TRACK TRAINING OCTAVE EN MIm (4 boucles)')).toBeNull()
    expect(parseTempo('Morceau 5 bpm')).toBeNull() // un seul chiffre : pas un tempo
    expect(parseTempo('Version 999 bpm')).toBeNull() // hors de toute musique jouable
  })
})

describe('groupBackingTracks', () => {
  it('range un même morceau en échelle de tempos, du plus lent au plus rapide', () => {
    const items = groupBackingTracks(
      ['80', '90', '110', '130', '150', '160'].map((bpm) => audio(`Training Triangle magique ${bpm} bpm`)),
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'ladder', title: 'Training Triangle magique' })
    expect(items[0].kind === 'ladder' && items[0].tracks.map((t) => t.bpm)).toEqual([80, 90, 110, 130, 150, 160])
  })

  it('rapproche les titres qui ne diffèrent que d\'une faute de frappe (noms réels du cours)', () => {
    // Ordre du serveur : tri alphabétique, donc la variante fautive arrive en premier.
    const items = groupBackingTracks([
      audio('Full barres acon Red hot ! 90BPM'),
      audio('Full barres facon des Red hot ! 80BPM'),
      audio('Full barres facon Red hot ! 60BPM'),
      audio('Full barres facon Red hot ! 70BPMwav'),
    ])
    expect(items).toHaveLength(1)
    // Le titre retenu est le plus fréquent, pas la variante fautive.
    expect(items[0]).toMatchObject({ kind: 'ladder', title: 'Full barres facon Red hot !' })
    expect(items[0].kind === 'ladder' && items[0].tracks.map((t) => t.bpm)).toEqual([60, 70, 80, 90])
  })

  it('laisse seuls les morceaux sans tempo, même aux titres proches', () => {
    const items = groupBackingTracks([
      audio('BACKING TRACK SANS GUITARE TRAINING ARPEGE EN MIm (4 boucles)'),
      audio('BACKING TRACK TRAINING OCTAVE EN MIm (4 boucles)'),
    ])
    expect(items.map((item) => item.kind)).toEqual(['single', 'single'])
    expect(items[0]).toMatchObject({ bpm: null, title: 'BACKING TRACK SANS GUITARE TRAINING ARPEGE EN MIm (4 boucles)' })
  })

  it('ne mélange pas deux exercices différents', () => {
    const items = groupBackingTracks([
      audio('Exo A 80 bpm'),
      audio('Exo A 100 bpm'),
      audio('Exo B 80 bpm'),
      audio('Exo B 100 bpm'),
    ])
    expect(items.map((item) => item.title)).toEqual(['Exo A', 'Exo B'])
  })

  it('garde entier le titre d\'un morceau qui n\'existe qu\'à un tempo', () => {
    const [item] = groupBackingTracks([audio('Blues en La 90 bpm')])
    expect(item).toMatchObject({ kind: 'single', title: 'Blues en La 90 bpm', bpm: 90 })
  })

  it('conserve l\'ordre d\'apparition', () => {
    const items = groupBackingTracks([audio('Intro'), audio('Riff 80 bpm'), audio('Outro'), audio('Riff 100 bpm')])
    expect(items.map((item) => item.title)).toEqual(['Intro', 'Riff', 'Outro'])
  })
})
