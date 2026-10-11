import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyPaths, prefixLegacyPath } from './migrate.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('prefixLegacyPath', () => {
  const names = new Set(['Méthode polyvalante', 'Autre méthode'])
  it('ajoute le nom de la méthode d\'origine aux anciens chemins', () => {
    expect(prefixLegacyPath('1 CHAP 1/x.mp4', names)).toBe('Méthode polyvalante/1 CHAP 1/x.mp4')
  })
  it('laisse les chemins déjà préfixés', () => {
    expect(prefixLegacyPath('Autre méthode/a.mp4', names)).toBe('Autre méthode/a.mp4')
    expect(prefixLegacyPath('Méthode polyvalante/a.mp4', names)).toBe('Méthode polyvalante/a.mp4')
  })
})

describe('migrateLegacyPaths', () => {
  it('migre progression et favoris, garde une copie, et ne refait rien la seconde fois', async () => {
    const courses = path.join(dir, 'cours')
    await mkdir(path.join(courses, 'Méthode polyvalante'), { recursive: true })
    await mkdir(path.join(courses, 'Autre méthode'), { recursive: true })
    const progress = path.join(dir, 'progress.json')
    const favorites = path.join(dir, 'favorites.json')
    const entry = { position: 1, duration: 2, completed: false, updatedAt: 'x' }
    // Une clé avec les accents mal extraits des zips doit traverser la migration sans changement.
    const weird = `1 CHAP 1/Part A pre${String.fromCharCode(0x2560)}${String.fromCharCode(0xfc)}cision/a.mp4`
    await writeFile(progress, JSON.stringify({ [weird]: entry, 'Autre méthode/b.mp4': entry }), 'utf8')
    await writeFile(favorites, JSON.stringify([weird, 'Méthode polyvalante/deja.mp4']), 'utf8')

    await migrateLegacyPaths(courses, progress, favorites)

    const migrated = JSON.parse(await readFile(progress, 'utf8'))
    expect(Object.keys(migrated).sort()).toEqual([`Méthode polyvalante/${weird}`, 'Autre méthode/b.mp4'].sort())
    expect(JSON.parse(await readFile(favorites, 'utf8'))).toEqual([
      `Méthode polyvalante/${weird}`,
      'Méthode polyvalante/deja.mp4',
    ])
    // Copie de sécurité = contenu d'origine.
    expect(Object.keys(JSON.parse(await readFile(`${progress}.avant-methodes-multiples`, 'utf8')))).toContain(weird)

    const before = await readFile(progress, 'utf8')
    await migrateLegacyPaths(courses, progress, favorites)
    expect(await readFile(progress, 'utf8')).toBe(before)
  })

  it('ne touche à rien si la méthode d\'origine n\'est plus là', async () => {
    const courses = path.join(dir, 'cours')
    await mkdir(path.join(courses, 'Autre méthode'), { recursive: true })
    const progress = path.join(dir, 'progress.json')
    await writeFile(progress, JSON.stringify({ 'x/a.mp4': {} }), 'utf8')
    await migrateLegacyPaths(courses, progress, path.join(dir, 'favorites.json'))
    expect(JSON.parse(await readFile(progress, 'utf8'))).toEqual({ 'x/a.mp4': {} })
  })
})
