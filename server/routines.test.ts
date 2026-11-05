import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { filterRoutines, formatClock, formatMinutes, stepInfo, totalMinutes } from '../src/routines.ts'
import { parseRoutineUpdate, readRoutines, saveRoutine } from './routines.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const matin = {
  id: 'a',
  name: 'Échauffement',
  steps: [
    { name: 'Chromatique', minutes: 5, details: '80 bpm' },
    { name: 'Pentatonique de La', minutes: 10, details: '' },
  ],
  notes: '',
}

describe('routines', () => {
  it('ajoute, remplace puis supprime une routine', async () => {
    const file = path.join(dir, 'routines.json')
    expect(await readRoutines(file)).toEqual([])
    await saveRoutine(file, 'a', matin)
    await saveRoutine(file, 'b', { ...matin, id: 'b', name: 'Accords' })
    await saveRoutine(file, 'a', { ...matin, name: 'Échauffement 2' })
    expect((await readRoutines(file)).map((r) => r.name)).toEqual(['Échauffement 2', 'Accords'])
    await saveRoutine(file, 'a', null)
    expect((await readRoutines(file)).map((r) => r.id)).toEqual(['b'])
  })

  it('refuse une routine incorrecte', () => {
    expect(parseRoutineUpdate({ id: 'a', routine: matin })).toEqual({ id: 'a', routine: matin })
    expect(parseRoutineUpdate({ id: 'a', routine: null })).toEqual({ id: 'a', routine: null })
    expect(parseRoutineUpdate({ id: 'b', routine: matin })).toBeNull()
    expect(parseRoutineUpdate({ id: 'a', routine: { ...matin, steps: [{ name: 'X', minutes: 0, details: '' }] } })).toBeNull()
    expect(parseRoutineUpdate({ id: 'a', routine: { ...matin, steps: [{ name: 'X', minutes: 2.5, details: '' }] } })).toBeNull()
    expect(parseRoutineUpdate({ id: 'a', routine: { ...matin, steps: 'Gammes' } })).toBeNull()
    const tempo = (bpm: unknown) => ({ ...matin, steps: [{ name: 'X', minutes: 5, details: '', bpm }] })
    expect(parseRoutineUpdate({ id: 'a', routine: tempo(80) })).not.toBeNull()
    expect(parseRoutineUpdate({ id: 'a', routine: tempo(5) })).toBeNull()
    expect(parseRoutineUpdate({ id: 'a', routine: tempo(80.5) })).toBeNull()
    expect(parseRoutineUpdate({ id: 'a', routine: tempo('80') })).toBeNull()
  })

  it('cherche par nom, exercice ou note, sans accents', () => {
    const soir = { ...matin, id: 'b', name: 'Soir', steps: [{ name: 'Barrés', minutes: 15, details: 'Fa, Si bémol' }] }
    expect(filterRoutines([matin, soir], 'echauffement').map((r) => r.id)).toEqual(['a'])
    expect(filterRoutines([matin, soir], 'bemol').map((r) => r.id)).toEqual(['b'])
    expect(filterRoutines([matin, soir], ' ').map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('compte et écrit la durée', () => {
    expect(totalMinutes(matin)).toBe(15)
    expect(stepInfo({ name: 'X', minutes: 5, details: 'aller-retour', bpm: 80 })).toBe('♩ = 80 · aller-retour')
    expect(stepInfo({ name: 'X', minutes: 5, details: '' })).toBe('')
    expect([45, 60, 75].map(formatMinutes)).toEqual(['45 min', '1 h', '1 h 15'])
    expect([300_000, 245_001, 999, 0, -50].map(formatClock)).toEqual(['5:00', '4:06', '0:01', '0:00', '0:00'])
  })

  it('ne montre pas une routine abîmée à la main', async () => {
    const file = path.join(dir, 'routines.json')
    await writeFile(file, JSON.stringify([matin, { ...matin, id: 'x', steps: null }]))
    expect((await readRoutines(file)).map((r) => r.id)).toEqual(['a'])
  })
})
