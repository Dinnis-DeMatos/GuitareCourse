import { describe, expect, it } from 'vitest'
import { buildJournal, groupByDay } from './journal.ts'
import { nextProgress } from './progress.ts'

const empty = { progress: null, lessons: [], trainer: null, chords: null, tones: null, routines: null, runs: null }

describe('parcours', () => {
  it('réunit les événements datés, du plus récent au plus ancien', () => {
    const events = buildJournal({
      ...empty,
      progress: {
        'a.mp4': { position: 0, duration: 10, completed: true, updatedAt: '2026-11-05T10:00:00Z', completedAt: '2026-11-01T10:00:00Z' },
        'b.mp4': { position: 3, duration: 10, completed: false, updatedAt: '2026-11-04T10:00:00Z' },
        'gone.mp4': { position: 0, duration: 10, completed: true, updatedAt: '2026-11-04T10:00:00Z' },
      },
      lessons: [
        { id: 'a.mp4', title: 'Octaves', course: 'Méthode' },
        { id: 'b.mp4', title: 'Tierces', course: 'Méthode' },
      ],
      trainer: [{ date: '2026-11-03T10:00:00Z', mode: 'series', right: 9, tries: 10 }],
      runs: [{ date: '2026-11-04T09:00:00Z', name: 'Matin', minutes: 15 }],
      chords: [{ id: 'c', name: 'Blues', chords: [], notes: '' }],
    })
    expect(events.map((e) => [e.kind, e.title])).toEqual([
      ['run', 'Matin'],
      ['trainer', 'Notes du manche'],
      ['lesson', 'Octaves'],
    ])
    expect(events[1].detail).toBe('9 trouvées sur 10 · série')
  })

  it('regroupe par jour, en heure locale', () => {
    const now = new Date(2026, 10, 5, 12)
    const at = (d: number, h: number) => ({ date: new Date(2026, 10, d, h).toISOString(), kind: 'run' as const, title: '', detail: '' })
    const days = groupByDay([at(5, 9), at(5, 8), at(4, 23), at(3, 7), at(3, 1)], now)
    expect(days.map((d) => [d.label, d.events.length])).toEqual([
      ["Aujourd'hui", 2],
      ['Hier', 1],
      ['mardi 3 novembre', 2],
    ])
  })

  it('garde la date de la première fois où une leçon est terminée', () => {
    const first = nextProgress(undefined, { position: 100, duration: 100, completed: true }, '2026-11-01T00:00:00Z')
    expect(first.completedAt).toBe('2026-11-01T00:00:00Z')
    const again = nextProgress(first, { position: 20, duration: 100, completed: true }, '2026-11-05T00:00:00Z')
    expect(again.completedAt).toBe('2026-11-01T00:00:00Z')
    // Terminée avant qu'on note la date : on garde sa dernière mise à jour d'alors.
    const old = { position: 0, duration: 100, completed: true, updatedAt: '2026-10-11T00:00:00Z' }
    expect(nextProgress(old, { position: 5, duration: 100, completed: true }, '2026-11-05T00:00:00Z').completedAt).toBe('2026-10-11T00:00:00Z')
    expect(nextProgress(again, { position: 0, duration: 100, completed: false }, '2026-11-06T00:00:00Z').completedAt).toBeUndefined()
  })
})
