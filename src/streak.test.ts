import { describe, expect, it } from 'vitest'
import { nextProgress } from './progress.ts'
import { readStreak, stageIndex } from './streak.ts'

const at = (month: number, day: number, hour = 10) => new Date(2026, month - 1, day, hour).toISOString()
const now = new Date(2026, 10, 5, 12)

describe('série de la mascotte', () => {
  it('compte les jours d’affilée, une seule fois chacun', () => {
    expect(readStreak({}, [at(11, 5), at(11, 5, 23), at(11, 4), at(11, 3), at(11, 1)], now)).toEqual({ days: 3, today: true })
  })

  it('tient jusqu’au soir, se perd après un jour manqué', () => {
    expect(readStreak({}, [at(11, 4), at(11, 3)], now)).toEqual({ days: 2, today: false })
    expect(readStreak({}, [at(11, 3), at(11, 2)], now)).toEqual({ days: 0, today: false })
  })

  it('passe les mois et les changements d’heure', () => {
    expect(readStreak({}, [24, 25, 26, 27, 28, 29, 30, 31, 32].map((d) => at(10, d, 0)), new Date(2026, 10, 1, 0, 30))).toEqual({ days: 9, today: true })
  })

  it('garde chaque jour où une même leçon est revue, même remise « à voir »', () => {
    const watch = (position: number, completed = false) => ({ position, duration: 100, completed })
    let entry = nextProgress(undefined, watch(20), at(11, 2))
    entry = nextProgress(entry, watch(0, true), at(11, 3)) // terminée
    entry = nextProgress(entry, watch(30, true), at(11, 4)) // revue
    expect(readStreak({ a: entry }, [], now)).toEqual({ days: 3, today: false })
    entry = nextProgress(entry, watch(0), at(11, 5)) // décochée : ce n'est pas travailler
    expect(readStreak({ a: entry }, [], now)).toEqual({ days: 3, today: false })
  })

  it('reprend les dates d’avant la mascotte', () => {
    const old = { position: 10, duration: 100, completed: true, updatedAt: at(11, 4), completedAt: at(11, 3) }
    expect(readStreak({ a: old }, [], now).days).toBe(2)
    expect(readStreak({ a: nextProgress(old, { position: 20, duration: 100, completed: true }, at(11, 5)) }, [], now).days).toBe(3)
  })

  it('évolue pile au seuil', () => {
    expect([0, 1, 2, 3, 6, 7, 14, 30, 60, 99, 100, 400].map(stageIndex)).toEqual([0, 1, 1, 2, 2, 3, 4, 5, 6, 6, 7, 7])
  })
})
