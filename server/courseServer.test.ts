import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_NOTES_LENGTH } from '../src/limits.ts'
import { courseHandler } from './courseServer.ts'

let dir: string
let server: Server
let base: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
  await mkdir(path.join(dir, 'cours'))
  await writeFile(path.join(dir, 'cours', 'video.mp4'), '0123456789')
  await writeFile(path.join(dir, 'secret.json'), '{}')
  const handler = courseHandler(path.join(dir, 'cours'), dir, () => undefined)
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

  it('enregistre des notes aussi longues que le permet la limite', async () => {
    const annotations = { notes: 'é'.repeat(MAX_NOTES_LENGTH), bookmarks: [] }
    expect((await send('/api/annotations', 'PUT', { path: 'a.mp4', ...annotations })).status).toBe(200)
  })
})

/** Requête avec des en-têtes Host et Origin choisis (fetch ne laisse pas changer Host). */
const statusWith = (headers: Record<string, string>) =>
  new Promise<number>((resolve, reject) => {
    const req = request(base + '/api/backups', { method: 'POST', headers }, (res) => (res.resume(), resolve(res.statusCode!)))
    req.on('error', reject)
    req.end('{"name":"nope"}')
  })

describe('fichiers du cours (/media)', () => {
  const range = (url: string, header: string) => fetch(base + url, { headers: { range: header } })

  it('sert un fichier, en entier ou en partie', async () => {
    expect(await (await fetch(base + '/media/video.mp4')).text()).toBe('0123456789')
    const part = await range('/media/video.mp4', 'bytes=2-4')
    expect([part.status, part.headers.get('content-range'), await part.text()]).toEqual([206, 'bytes 2-4/10', '234'])
    expect(await (await range('/media/video.mp4', 'bytes=-3')).text()).toBe('789')
    expect(await (await range('/media/video.mp4', 'bytes=8-')).text()).toBe('89')
  })

  it('refuse une plage impossible (416)', async () => {
    for (const header of ['bytes=10-', 'bytes=5-2', 'bytes=-', 'octets=0-1']) {
      expect((await range('/media/video.mp4', header)).status).toBe(416)
    }
  })

  it('ne sort jamais du dossier du cours', async () => {
    // Encodés : fetch ne normalise pas %2E%2E ni %2F, le serveur les reçoit tels quels.
    for (const url of ['/media/%2E%2E%2Fsecret.json', '/media/..%2F..%2Fsecret.json', '/media/C%3A%5CWindows%5Cwin.ini']) {
      expect((await fetch(base + url)).status).toBe(403)
    }
    expect((await fetch(base + '/media/absent.mp4')).status).toBe(404)
  })
})

describe('accès au service', () => {
  it("accepte l'application et refuse un autre site ou un autre nom d'hôte", async () => {
    const host = new URL(base).host
    expect(await statusWith({ origin: base })).toBe(400)
    expect(await statusWith({ origin: 'https://example.com' })).toBe(403)
    expect(await statusWith({ host: `evil.example:${new URL(base).port}` })).toBe(403)
    expect(await statusWith({ host, origin: 'null' })).toBe(403)
  })
})
