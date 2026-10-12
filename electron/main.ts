// Processus principal de l'application de bureau : le même service que le serveur de développement
// (courseHandler) tourne sur cet ordinateur uniquement, sur un port libre, et sert aussi l'application
// construite à la fenêtre. Rien n'est exposé au réseau ni chargé depuis Internet.

import { app, BrowserWindow, Menu, session, shell } from 'electron'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { courseHandler } from '../server/courseServer.ts'

// Lancé par `npm run electron:dev` : on charge le serveur Vite (rechargement à chaud) plutôt que l'app construite.
const DEV_URL = process.env.ELECTRON_DEV_URL
// Dossier de l'application construite : à côté de ce fichier une fois empaquetée, sinon dist/ du projet.
const DIST = app.isPackaged ? path.join(__dirname, 'dist') : path.resolve('dist')

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/** Démarre le service local ; renvoie l'adresse racine de l'application. */
function startServer(): Promise<string> {
  // Empaquetée, la progression vit dans le profil de l'utilisateur ; sinon on suit data/ (ou les variables d'environnement).
  const data = (name: string) => (app.isPackaged ? path.join(app.getPath('userData'), 'data', name) : undefined)
  const handler = courseHandler(undefined, data('progress.json'), data('favorites.json'), data('annotations.json'))

  const server = createServer((req, res) => {
    void handler(req, res, async () => {
      const name = new URL(req.url ?? '/', 'http://localhost').pathname.slice(1) || 'index.html'
      const file = path.join(DIST, name)
      // Jamais en dehors du dossier de l'application.
      const inside = path.relative(DIST, file)
      const found = req.method === 'GET' && !inside.startsWith('..') && !path.isAbsolute(inside)
      if (!found || !(await stat(file).then((s) => s.isFile(), () => false))) {
        res.statusCode = 404
        return res.end('Introuvable')
      }
      res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
      createReadStream(file).pipe(res)
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    // Port libre, boucle locale seulement.
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`))
  })
}

async function createWindow() {
  const root = DEV_URL ?? (await startServer())
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#141414',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())

  // Les liens externes s'ouvrent dans le navigateur par défaut ; la fenêtre ne quitte jamais l'application.
  const external = (url: string) => /^https?:\/\//.test(url) && void shell.openExternal(url)
  win.webContents.setWindowOpenHandler(({ url }) => (external(url), { action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === new URL(root).origin) return
    event.preventDefault()
    external(url)
  })

  await win.loadURL(root)
}

// Une seule instance : deux fenêtres écriraient en même temps dans la même progression.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win?.isMinimized()) win.restore()
    win?.focus()
  })
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    // Aucune permission (caméra, micro, notifications…) n'est jamais accordée.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    return createWindow()
  })
  app.on('window-all-closed', () => app.quit())
}
