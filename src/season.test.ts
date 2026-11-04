import { describe, expect, it } from 'vitest'
import { daysUntilChristmas } from './season.ts'

describe('jours avant Noël', () => {
  it('compte les jours, quelle que soit l’heure', () => {
    expect(daysUntilChristmas(new Date(2026, 10, 4, 23, 59))).toBe(51)
    expect(daysUntilChristmas(new Date(2026, 11, 24, 8))).toBe(1)
  })
  it('vaut 0 le jour de Noël, puis repart vers le suivant', () => {
    expect(daysUntilChristmas(new Date(2026, 11, 25, 20))).toBe(0)
    expect(daysUntilChristmas(new Date(2026, 11, 26))).toBe(364)
  })
  it('traverse le changement d’heure d’octobre', () => {
    expect(daysUntilChristmas(new Date(2026, 9, 24))).toBe(62)
  })
})
