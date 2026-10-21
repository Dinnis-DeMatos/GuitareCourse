import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseSessionResult, readTrainer, saveSession } from './trainer.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('exercice du manche', () => {
  it('cumule le bilan des notes et garde les séances dans l’ordre', async () => {
    const file = path.join(dir, 'trainer.json')
    expect(await readTrainer(file)).toEqual({ notes: {}, sessions: [] })
    const first = { mode: 'free' as const, right: 3, tries: 4, time: 9000 }
    await saveSession(file, { ...first, notes: { '4-7': { tries: 2, misses: 1, found: 1, time: 4000 } } }, new Date('2026-10-21'))
    const data = await saveSession(file, {
      mode: 'timed',
      right: 5,
      tries: 5,
      time: 8000,
      notes: { '4-7': { tries: 1, misses: 0, found: 1, time: 2000 } },
    })
    expect(data.notes['4-7']).toEqual({ tries: 3, misses: 1, found: 2, time: 6000 })
    expect(data.sessions.map((s) => s.mode)).toEqual(['free', 'timed'])
    expect(data.sessions[0]).toMatchObject({ date: '2026-10-21T00:00:00.000Z', right: 3, tries: 4, time: 9000 })
  })

  it('refuse une séance mal formée', () => {
    const ok = { mode: 'free', right: 1, tries: 2, time: 1500, notes: { '0-11': { tries: 1, misses: 1, found: 1, time: 1500 } } }
    expect(parseSessionResult(ok)).toEqual(ok)
    expect(parseSessionResult({ ...ok, time: -1 })).toBeNull()
    expect(parseSessionResult({ ...ok, notes: { '0-1': { tries: 1, misses: 0, found: 2, time: 0 } } })).toBeNull()
    expect(parseSessionResult({ ...ok, mode: 'autre' })).toBeNull()
    expect(parseSessionResult({ ...ok, right: 3 })).toBeNull()
    expect(parseSessionResult({ ...ok, notes: { '6-0': { tries: 1, misses: 0, found: 0, time: 0 } } })).toBeNull()
    expect(parseSessionResult({ ...ok, notes: { '0-12': { tries: 1, misses: 0, found: 0, time: 0 } } })).toBeNull()
    expect(parseSessionResult({ ...ok, notes: { '0-1': { tries: 1, misses: 2, found: 0, time: 0 } } })).toBeNull()
  })

  it('relit un bilan d’avant les temps de réponse', async () => {
    const file = path.join(dir, 'trainer.json')
    await writeFile(file, JSON.stringify({ notes: { '1-0': { tries: 2, misses: 1 } }, sessions: [] }))
    const data = await saveSession(file, { mode: 'free', right: 1, tries: 1, time: 3000, notes: { '1-0': { tries: 1, misses: 0, found: 1, time: 3000 } } })
    expect(data.notes['1-0']).toEqual({ tries: 3, misses: 1, found: 1, time: 3000 })
  })
})
