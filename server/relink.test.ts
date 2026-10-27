import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CourseFolder } from '../src/courseTypes.ts'
import { findMoves, relinkMoved } from './relink.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('findMoves', () => {
  it('suit une vidéo dont le dossier a été renommé', () => {
    const videos = new Map([['M/Chap 1 bis/a.mp4', 100]])
    const moves = findMoves(videos, { 'M/Chap 1/a.mp4': 100 }, new Set(['M/Chap 1/a.mp4']))
    expect([...moves]).toEqual([['M/Chap 1/a.mp4', 'M/Chap 1 bis/a.mp4']])
  })

  it('ne devine rien quand deux vidéos ont la même taille', () => {
    const videos = new Map([
      ['M/x.mp4', 100],
      ['M/y.mp4', 100],
    ])
    expect(findMoves(videos, { 'M/old.mp4': 100 }, new Set(['M/old.mp4'])).size).toBe(0)
  })

  it("ignore une vidéo qui a déjà ses données, une autre extension, ou une taille jamais vue", () => {
    const videos = new Map([
      ['M/a.mp4', 100],
      ['M/b.wav', 200],
    ])
    const keys = new Set(['M/a.mp4', 'M/old.mp4', 'M/old2.mp4', 'M/inconnue.mp4'])
    expect(findMoves(videos, { 'M/old.mp4': 100, 'M/old2.mp4': 200 }, keys).size).toBe(0)
  })
})

describe('relinkMoved', () => {
  it('déplace progression, favori et notes, et retient les tailles', async () => {
    const file = (name: string) => path.join(dir, name)
    const entry = { position: 5, duration: 60, completed: false, updatedAt: 'x' }
    await writeFile(file('sizes.json'), JSON.stringify({ 'M/Chap/a.mp4': 100 }))
    await writeFile(file('progress.json'), JSON.stringify({ 'M/Chap/a.mp4': entry }))
    await writeFile(file('favorites.json'), JSON.stringify(['M/Chap/a.mp4']))
    await writeFile(file('annotations.json'), JSON.stringify({ 'M/Chap/a.mp4': { notes: 'n', bookmarks: [] } }))
    const course: CourseFolder = {
      name: 'cours',
      path: '',
      files: [],
      folders: [
        {
          name: 'Chapitre',
          path: 'M/Chapitre',
          folders: [],
          files: [{ title: 'a', ext: 'mp4', kind: 'video', path: 'M/Chapitre/a.mp4', size: 100 }],
        },
      ],
    }

    const moved = await relinkMoved(course, file('sizes.json'), file('progress.json'), file('favorites.json'), file('annotations.json'))

    const read = async (name: string) => JSON.parse(await readFile(file(name), 'utf8'))
    expect(moved).toBe(1)
    expect(await read('progress.json')).toEqual({ 'M/Chapitre/a.mp4': entry })
    expect(await read('favorites.json')).toEqual(['M/Chapitre/a.mp4'])
    expect(Object.keys(await read('annotations.json'))).toEqual(['M/Chapitre/a.mp4'])
    expect(await read('sizes.json')).toEqual({ 'M/Chapitre/a.mp4': 100 })
  })
})
