import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { filterTones } from '../src/tones.ts'
import { parseToneUpdate, readTones, saveTone } from './tones.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const crunch = {
  id: 'a',
  artist: 'AC/DC',
  name: 'Crunch',
  amp: 'Marshall',
  knobs: [{ label: 'Gain', value: 7.5 }],
  pedals: [{ name: 'Tube Screamer', settings: 'Drive 3' }],
  notes: '',
}

describe('sons', () => {
  it('ajoute, remplace puis supprime un son', async () => {
    const file = path.join(dir, 'tones.json')
    expect(await readTones(file)).toEqual([])
    await saveTone(file, 'a', crunch)
    await saveTone(file, 'b', { ...crunch, id: 'b', name: 'Clean' })
    await saveTone(file, 'a', { ...crunch, name: 'Crunch 2' })
    expect((await readTones(file)).map((t) => t.name)).toEqual(['Crunch 2', 'Clean'])
    await saveTone(file, 'a', null)
    expect((await readTones(file)).map((t) => t.id)).toEqual(['b'])
  })

  it('refuse un son incorrect', () => {
    expect(parseToneUpdate({ id: 'a', tone: crunch })).toEqual({ id: 'a', tone: crunch })
    expect(parseToneUpdate({ id: 'a', tone: null })).toEqual({ id: 'a', tone: null })
    expect(parseToneUpdate({ id: 'b', tone: crunch })).toBeNull()
    expect(parseToneUpdate({ id: 'a', tone: { ...crunch, knobs: [{ label: 'Gain', value: 11 }] } })).toBeNull()
    expect(parseToneUpdate({ id: 'a', tone: { ...crunch, knobs: [{ label: 'Gain', value: 7.3 }] } })).toBeNull()
    expect(parseToneUpdate({ id: 'a', tone: { ...crunch, pedals: 'Fuzz' } })).toBeNull()
  })

  it('cherche par artiste, titre, ampli, pédale ou note, sans accents', () => {
    const clean = { ...crunch, id: 'b', artist: 'Téléphone', name: 'Clean', amp: 'Fender', pedals: [] }
    expect(filterTones([crunch, clean], 'telephone').map((t) => t.id)).toEqual(['b'])
    expect(filterTones([crunch, clean], 'tube marshall').map((t) => t.id)).toEqual(['a'])
    expect(filterTones([crunch, { ...clean, notes: 'Drop D' }], 'drop d').map((t) => t.id)).toEqual(['b'])
    expect(filterTones([crunch, clean], ' ').map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('ne montre pas un son abîmé à la main', async () => {
    const file = path.join(dir, 'tones.json')
    await writeFile(file, JSON.stringify([crunch, { ...crunch, id: 'x', knobs: null }]))
    expect((await readTones(file)).map((t) => t.id)).toEqual(['a'])
  })
})
