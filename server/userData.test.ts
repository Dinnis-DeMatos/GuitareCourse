import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateDataFiles } from './userData.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('migrateDataFiles', () => {
  it('copie les anciennes données, sans jamais écraser un fichier déjà présent', async () => {
    const oldDir = path.join(dir, 'data')
    const newDir = path.join(dir, 'userData', 'data')
    await mkdir(oldDir, { recursive: true })
    await mkdir(newDir, { recursive: true })
    await writeFile(path.join(oldDir, 'progress.json'), '{"ancien":1}')
    await writeFile(path.join(oldDir, 'favorites.json'), '{"ancien":2}')
    await writeFile(path.join(newDir, 'favorites.json'), '{"nouveau":2}')

    await migrateDataFiles([path.join(dir, 'absent'), oldDir], newDir)

    expect(await readFile(path.join(newDir, 'progress.json'), 'utf8')).toBe('{"ancien":1}')
    expect(await readFile(path.join(newDir, 'favorites.json'), 'utf8')).toBe('{"nouveau":2}')
    // L'ancien dossier reste intact (copie, pas déplacement).
    expect(await readFile(path.join(oldDir, 'favorites.json'), 'utf8')).toBe('{"ancien":2}')
  })

  it('ne fait rien sans ancien dossier, et ne crée pas de fichier vide', async () => {
    const newDir = path.join(dir, 'neuf')
    await migrateDataFiles([path.join(dir, 'absent')], newDir)
    await expect(readFile(path.join(newDir, 'progress.json'))).rejects.toThrow()
  })
})
