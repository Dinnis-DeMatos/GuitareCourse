import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseProgressionUpdate, readProgressions, saveProgression } from './chords.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const balade = { id: 'a', name: 'Balade', chords: ['Am', 'F', 'C', 'G'], bpm: 72, notes: '' }

describe('carnet d\'accords', () => {
  it('ajoute, remplace puis supprime une suite', async () => {
    const file = path.join(dir, 'chords.json')
    expect(await readProgressions(file)).toEqual([])
    await saveProgression(file, 'a', balade)
    await saveProgression(file, 'b', { ...balade, id: 'b', name: 'Blues' })
    await saveProgression(file, 'a', { ...balade, name: 'Balade du soir' })
    expect((await readProgressions(file)).map((p) => p.name)).toEqual(['Balade du soir', 'Blues'])
    await saveProgression(file, 'a', null)
    expect((await readProgressions(file)).map((p) => p.id)).toEqual(['b'])
  })

  it('refuse une suite incorrecte', () => {
    expect(parseProgressionUpdate({ id: 'a', progression: balade })).toEqual({ id: 'a', progression: balade })
    expect(parseProgressionUpdate({ id: 'a', progression: null })).toEqual({ id: 'a', progression: null })
    expect(parseProgressionUpdate({ id: 'b', progression: balade })).toBeNull()
    expect(parseProgressionUpdate({ id: 'a', progression: { ...balade, bpm: 5 } })).toBeNull()
    expect(parseProgressionUpdate({ id: 'a', progression: { ...balade, chords: [''] } })).toBeNull()
  })
})
