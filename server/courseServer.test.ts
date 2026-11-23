import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { courseHandler } from './courseServer.ts'

let dir: string
let server: Server
let base: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
  await mkdir(path.join(dir, 'cours'))
  const data = (name: string) => path.join(dir, name)
  const handler = courseHandler(
    path.join(dir, 'cours'),
    data('progress.json'),
    data('favorites.json'),
    data('annotations.json'),
    data('trainer.json'),
    data('chords.json'),
    data('sizes.json'),
    data('tones.json'),
    data('routines.json'),
    data('routine-runs.json'),
    () => undefined,
  )
  server = createServer((req, res) => handler(req, res, () => ((res.statusCode = 404), res.end())))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  await rm(dir, { recursive: true, force: true })
})

const send = (url: string, method: string, body?: unknown) =>
  fetch(base + url, { method, body: body === undefined ? undefined : JSON.stringify(body) })

describe('API des données', () => {
  it('enregistre puis relit un favori', async () => {
    expect(await (await send('/api/favorites', 'GET')).json()).toEqual([])
    const put = await send('/api/favorites', 'PUT', { path: 'a.mp4', favorite: true })
    expect(put.status).toBe(200)
    expect(await (await send('/api/favorites', 'GET')).json()).toEqual(['a.mp4'])
  })

  it('renvoie les annotations enregistrées', async () => {
    const annotations = { notes: 'ok', bookmarks: [] }
    const put = await send('/api/annotations', 'PUT', { path: 'a.mp4', ...annotations })
    expect(await put.json()).toEqual(annotations)
  })

  it('refuse un corps invalide ou illisible (400) et une autre méthode (405)', async () => {
    const invalid = await send('/api/progress', 'PUT', { path: 'a.mp4' })
    expect([invalid.status, await invalid.json()]).toEqual([400, { error: 'Progression invalide.' }])
    expect((await fetch(base + '/api/tones', { method: 'PUT', body: '{' })).status).toBe(400)
    expect((await send('/api/routine-runs', 'PUT', {})).status).toBe(405)
    expect((await send('/api/routines', 'POST', {})).status).toBe(405)
  })

  it('refuse une sauvegarde inconnue', async () => {
    expect((await send('/api/backups', 'POST', { name: 'nope' })).status).toBe(400)
  })
})
