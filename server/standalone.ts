// Point d'entrée de l'exécutable GuitareCourse.exe (voir scripts/build-exe.mjs) : le même service
// que le serveur de développement, plus l'application construite (embarquée dans l'exécutable),
// puis une fenêtre d'application. Fermer cette fenêtre arrête le serveur.

import { spawn } from 'node:child_process'
import { appendFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { getAsset, getAssetKeys } from 'node:sea'
import { courseHandler } from './courseServer.ts'

const PORT = Number(process.env.GUITARECOURSE_PORT) || 5174
const URL_ROOT = `http://localhost:${PORT}`
const HOME = path.dirname(process.execPath)

// Sans console (l'exécutable est une application fenêtrée), les erreurs vont dans un fichier.
function log(...parts: unknown[]) {
  try {
    appendFileSync(path.join(HOME, 'guitarecourse.log'), `${new Date().toISOString()} ${parts.join(' ')}\n`)
  } catch {
    // Dossier en lecture seule : tant pis.
  }
}
console.log = log
console.error = log
process.on('uncaughtException', (error) => log('erreur :', error.stack ?? error))

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

function sendAsset(key: string, res: import('node:http').ServerResponse, method: string | undefined): boolean {
  if (!getAssetKeys().includes(key)) return false
  const body = Buffer.from(getAsset(key))
  res.setHeader('Content-Type', TYPES[path.extname(key)] ?? 'application/octet-stream')
  // Les fichiers de /assets/ portent leur empreinte dans leur nom : ils ne changent jamais.
  res.setHeader('Cache-Control', key.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.setHeader('Content-Length', body.length)
  res.end(method === 'HEAD' ? undefined : body)
  return true
}

function isListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: 'localhost' })
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
}

function findBrowser(): string | null {
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(
    (value): value is string => Boolean(value),
  )
  const relative = ['Microsoft\\Edge\\Application\\msedge.exe', 'Google\\Chrome\\Application\\chrome.exe']
  for (const file of relative) {
    for (const root of roots) {
      const candidate = path.join(root, file)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/** Ouvre l'application dans sa propre fenêtre (sans barre d'adresse) ; s'arrête avec elle. */
function openWindow(stopWithWindow: boolean) {
  const browser = findBrowser()
  if (!browser) {
    // Pas de navigateur connu : la page s'ouvre dans celui par défaut, et le serveur reste actif.
    spawn('cmd.exe', ['/c', 'start', '', URL_ROOT], { stdio: 'ignore', windowsHide: true }).unref()
    return
  }
  // Un profil à part : la fenêtre est indépendante du navigateur habituel, et son processus ne
  // se termine que quand la fenêtre est fermée.
  const profile = path.join(process.env.LOCALAPPDATA ?? os.tmpdir(), 'GuitareCourse', 'fenetre')
  const child = spawn(
    browser,
    [
      `--app=${URL_ROOT}`,
      `--user-data-dir=${profile}`,
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-mode',
    ],
    { stdio: 'ignore' },
  )
  child.on('exit', () => process.exit(0))
  child.on('error', (error) => {
    log('fenêtre impossible :', error)
    if (!stopWithWindow) process.exit(1)
  })
}

async function main() {
  // Déjà lancé (ou serveur de développement) : on ne démarre pas un second service, on ouvre la fenêtre.
  if (await isListening(PORT)) return openWindow(true)

  const handler = courseHandler(
    undefined,
    process.env.PROGRESS_FILE ?? path.join(HOME, 'data', 'progress.json'),
    process.env.FAVORITES_FILE ?? path.join(HOME, 'data', 'favorites.json'),
    process.env.ANNOTATIONS_FILE ?? path.join(HOME, 'data', 'annotations.json'),
  )

  const server = createServer((req, res) => {
    void handler(req, res, () => {
      const pathname = new URL(req.url ?? '/', URL_ROOT).pathname
      const key = pathname === '/' ? 'index.html' : pathname.slice(1)
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405
        return res.end()
      }
      if (!sendAsset(key, res, req.method)) {
        res.statusCode = 404
        res.end('Introuvable')
      }
    })
  })
  server.on('error', (error) => {
    log('serveur impossible :', error)
    process.exit(1)
  })
  // Uniquement cet ordinateur : le dossier du cours n'est jamais exposé au réseau.
  server.listen(PORT, 'localhost', () => openWindow(false))
}

void main()
