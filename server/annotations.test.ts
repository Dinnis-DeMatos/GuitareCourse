import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseAnnotations, readAnnotations, saveAnnotations } from './annotations.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('parseAnnotations', () => {
  it('accepte des notes et des repères (instant ou passage)', () => {
    const value = {
      notes: 'à revoir',
      bookmarks: [
        { id: 'a', time: 12.5, label: 'octaves' },
        { id: 'b', time: 30, end: 45, label: 'passage' },
      ],
    }
    expect(parseAnnotations(value)).toEqual(value)
  })

  it('refuse les données mal formées', () => {
    expect(parseAnnotations(null)).toBeNull()
    expect(parseAnnotations({ notes: 1, bookmarks: [] })).toBeNull()
    expect(parseAnnotations({ notes: '', bookmarks: 'x' })).toBeNull()
    expect(parseAnnotations({ notes: '', bookmarks: [{ id: 'a', time: -1, label: '' }] })).toBeNull()
    // une fin avant le début n'est pas un passage
    expect(parseAnnotations({ notes: '', bookmarks: [{ id: 'a', time: 10, end: 5, label: '' }] })).toBeNull()
    expect(parseAnnotations({ notes: 'x'.repeat(20_001), bookmarks: [] })).toBeNull()
  })
})

describe('saveAnnotations', () => {
  it('enregistre, remplace et supprime les annotations vides', async () => {
    const file = path.join(dir, 'annotations.json')
    expect(await readAnnotations(file)).toEqual({})

    await saveAnnotations(file, 'Méthode/a.mp4', { notes: 'un', bookmarks: [] })
    await saveAnnotations(file, 'Méthode/b.mp4', { notes: '', bookmarks: [{ id: 'x', time: 3, label: 'r' }] })
    await saveAnnotations(file, 'Méthode/a.mp4', { notes: 'deux', bookmarks: [] })
    expect(await readAnnotations(file)).toEqual({
      'Méthode/a.mp4': { notes: 'deux', bookmarks: [] },
      'Méthode/b.mp4': { notes: '', bookmarks: [{ id: 'x', time: 3, label: 'r' }] },
    })

    await saveAnnotations(file, 'Méthode/a.mp4', { notes: '  ', bookmarks: [] })
    expect(Object.keys(await readAnnotations(file))).toEqual(['Méthode/b.mp4'])
  })
})
