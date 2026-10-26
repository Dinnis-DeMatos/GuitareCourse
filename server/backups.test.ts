import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BEFORE_RESTORE, KEPT_DAYS, backupDataFiles, listBackups, restoreBackup } from './backups.ts'
import { readJson, recoveries, updateJson } from './jsonStore.ts'

let dir: string
let progress: string
let favorites: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
  progress = path.join(dir, 'progress.json')
  favorites = path.join(dir, 'favorites.json')
  recoveries.length = 0
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const backups = () => readdir(path.join(dir, 'sauvegardes'))

describe('sauvegardes', () => {
  it('copie les fichiers lisibles, une sauvegarde par jour, et ne garde que les derniers jours', async () => {
    await writeFile(progress, '{"a.mp4":1}')
    for (let day = 1; day <= KEPT_DAYS + 2; day++) {
      await backupDataFiles([progress, favorites], `2026-10-${String(day).padStart(2, '0')}`)
    }
    const days = await backups()
    expect(days).toHaveLength(KEPT_DAYS)
    expect(days).not.toContain('2026-10-01')
    expect(await readdir(path.join(dir, 'sauvegardes', '2026-10-09'))).toEqual(['progress.json'])
  })

  it("n'écrase pas une bonne copie du jour par un fichier abîmé", async () => {
    await writeFile(progress, '{"a.mp4":1}')
    await backupDataFiles([progress], '2026-10-26')
    await writeFile(progress, '{abîmé')
    await backupDataFiles([progress], '2026-10-26')
    expect(await readFile(path.join(dir, 'sauvegardes', '2026-10-26', 'progress.json'), 'utf8')).toBe('{"a.mp4":1}')
  })

  it("restaure une sauvegarde après avoir gardé l'état actuel", async () => {
    await writeFile(progress, '{"ancien":1}')
    await backupDataFiles([progress, favorites], '2026-10-25')
    await writeFile(progress, '{"nouveau":2}')
    await writeFile(favorites, '["x"]')
    expect(await restoreBackup([progress, favorites], '2026-10-25')).toBe(true)
    expect(JSON.parse(await readFile(progress, 'utf8'))).toEqual({ ancien: 1 })
    // Absent de la sauvegarde : laissé tel quel.
    expect(JSON.parse(await readFile(favorites, 'utf8'))).toEqual(['x'])
    expect((await listBackups([progress, favorites])).map((b) => b.name)).toEqual([BEFORE_RESTORE, '2026-10-25'])
    // Et l'on peut revenir en arrière.
    await restoreBackup([progress, favorites], BEFORE_RESTORE)
    expect(JSON.parse(await readFile(progress, 'utf8'))).toEqual({ nouveau: 2 })
    expect(await restoreBackup([progress], 'inconnue')).toBe(false)
  })
})

describe('fichier abîmé', () => {
  it('reprend la dernière sauvegarde lisible et garde l\'original de côté', async () => {
    await writeFile(progress, '{"a.mp4":1}')
    await backupDataFiles([progress], '2026-10-24')
    await writeFile(progress, '{"a.mp4":2}')
    await backupDataFiles([progress], '2026-10-25')
    await writeFile(path.join(dir, 'sauvegardes', '2026-10-25', 'progress.json'), '{abîmée aussi')
    await writeFile(progress, '{"a.mp4": 3, coupé')

    // Deux lectures en même temps : une seule récupération.
    const [first, second] = await Promise.all([readJson(progress, {}), readJson(progress, {})])
    expect(first).toEqual({ 'a.mp4': 1 })
    expect(second).toEqual({ 'a.mp4': 1 })
    expect(recoveries).toHaveLength(1)
    expect(recoveries[0].backup).toBe('2026-10-24')
    expect(await readFile(path.join(dir, recoveries[0].kept), 'utf8')).toBe('{"a.mp4": 3, coupé')
    // Le fichier est réparé : la suite des écritures part de la sauvegarde.
    expect(await updateJson(progress, {}, (all) => ({ ...all, 'b.mp4': 1 }))).toEqual({ 'a.mp4': 1, 'b.mp4': 1 })
  })

  it('repart de zéro sans sauvegarde, sans rien effacer', async () => {
    await writeFile(favorites, '[abîmé')
    expect(await readJson(favorites, [])).toEqual([])
    expect(recoveries[0]).toMatchObject({ file: 'favorites.json', backup: null })
    expect(await readFile(path.join(dir, recoveries[0].kept), 'utf8')).toBe('[abîmé')
  })
})
