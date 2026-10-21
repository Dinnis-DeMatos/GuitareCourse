import { mkdtemp, rm } from 'node:fs/promises'
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
    await saveSession(file, { mode: 'free', right: 3, tries: 4, notes: { '4-7': { tries: 2, misses: 1 } } }, new Date('2026-10-21'))
    const data = await saveSession(file, { mode: 'timed', right: 5, tries: 5, notes: { '4-7': { tries: 1, misses: 0 } } })
    expect(data.notes['4-7']).toEqual({ tries: 3, misses: 1 })
    expect(data.sessions.map((s) => s.mode)).toEqual(['free', 'timed'])
    expect(data.sessions[0]).toMatchObject({ date: '2026-10-21T00:00:00.000Z', right: 3, tries: 4 })
  })

  it('refuse une séance mal formée', () => {
    const ok = { mode: 'free', right: 1, tries: 2, notes: { '0-11': { tries: 1, misses: 1 } } }
    expect(parseSessionResult(ok)).toEqual(ok)
    expect(parseSessionResult({ ...ok, mode: 'autre' })).toBeNull()
    expect(parseSessionResult({ ...ok, right: 3 })).toBeNull()
    expect(parseSessionResult({ ...ok, notes: { '6-0': { tries: 1, misses: 0 } } })).toBeNull()
    expect(parseSessionResult({ ...ok, notes: { '0-12': { tries: 1, misses: 0 } } })).toBeNull()
    expect(parseSessionResult({ ...ok, notes: { '0-1': { tries: 1, misses: 2 } } })).toBeNull()
  })
})
