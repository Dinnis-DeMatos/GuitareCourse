import { describe, expect, it } from 'vitest'
import { barLines, barStep, clampRatio, ratioOf } from './staff.ts'

describe('ratioOf', () => {
  it('place un instant entre 0 et 1', () => {
    expect(ratioOf(30, 120)).toBe(0.25)
    expect(ratioOf(-5, 120)).toBe(0)
    expect(ratioOf(500, 120)).toBe(1)
  })
  it('vaut 0 tant que la durée est inconnue', () => {
    expect(ratioOf(30, 0)).toBe(0)
    expect(ratioOf(30, Number.NaN)).toBe(0)
    expect(ratioOf(30, Number.POSITIVE_INFINITY)).toBe(0)
  })
  it('clampRatio borne la valeur', () => {
    expect(clampRatio(1.4)).toBe(1)
    expect(clampRatio(-0.1)).toBe(0)
  })
})

describe('barStep', () => {
  it('garde un nombre de barres lisible, de la vidéo courte à la longue', () => {
    expect(barStep(83)).toBe(10) // 1 min 23
    expect(barStep(487)).toBe(60) // 8 min
    expect(barStep(1020)).toBe(120) // 17 min
    expect(barStep(3 * 3600)).toBe(900) // 3 h : un quart d'heure
    for (const duration of [20, 83, 351, 487, 1020, 2400, 5400]) {
      expect(duration / barStep(duration)).toBeLessThanOrEqual(14)
    }
  })
})

describe('barLines', () => {
  it('numérote les minutes', () => {
    expect(barLines(500).map((bar) => bar.label)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    // 8 min 07 : la barre de la 8e minute serait collée à la fin, on ne la trace pas.
    expect(barLines(487).map((bar) => bar.label)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(barLines(1020).map((bar) => bar.label)).toEqual(['2', '4', '6', '8', '10', '12', '14', '16'])
  })
  it('affiche l\'instant pour les vidéos de moins de deux minutes', () => {
    expect(barLines(83).map((bar) => bar.label)).toEqual(['0:10', '0:20', '0:30', '0:40', '0:50', '1:00', '1:10', '1:20'])
  })
  it('ne trace rien au début, ni collé à la fin, ni sans durée', () => {
    expect(barLines(120).map((bar) => bar.time)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110])
    expect(barLines(0)).toEqual([])
    expect(barLines(Number.NaN)).toEqual([])
  })
})
