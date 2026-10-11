import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFavorites, setFavorite } from './favorites.ts'
import { readProgress, saveProgress } from './progress.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('favoris', () => {
  it('est vide tant que le fichier n\'existe pas', async () => {
    expect(await readFavorites(path.join(dir, 'favorites.json'))).toEqual([])
  })

  it('ajoute sans doublon, puis retire', async () => {
    const file = path.join(dir, 'favorites.json')
    await setFavorite(file, 'a.mp4', true)
    await setFavorite(file, 'b.mp4', true)
    await setFavorite(file, 'a.mp4', true)
    expect(await readFavorites(file)).toEqual(['b.mp4', 'a.mp4'])
    await setFavorite(file, 'b.mp4', false)
    expect(await readFavorites(file)).toEqual(['a.mp4'])
  })

  it('garde les accents et tous les ajouts simultanés', async () => {
    const file = path.join(dir, 'sous', 'favorites.json')
    const paths = Array.from({ length: 20 }, (_, i) => `Épisode ${i}/leçon créée.mp4`)
    await Promise.all(paths.map((p) => setFavorite(file, p, true)))
    expect((await readFavorites(file)).sort()).toEqual([...paths].sort())
  })
})

describe('progression', () => {
  it('enregistre sans écraser les autres vidéos', async () => {
    const file = path.join(dir, 'progress.json')
    await Promise.all([
      saveProgress(file, 'a.mp4', { position: 10, duration: 100, completed: false }),
      saveProgress(file, 'b.mp4', { position: 0, duration: 50, completed: true }),
    ])
    const all = await readProgress(file)
    expect(all['a.mp4']).toMatchObject({ position: 10, completed: false })
    expect(all['b.mp4']).toMatchObject({ duration: 50, completed: true })
  })
})
