// Processus principal de l'application de bureau : le même service que le serveur de développement
// (courseHandler) tourne sur cet ordinateur uniquement, sur un port libre, et sert aussi l'application
// construite à la fenêtre. Rien n'est exposé au réseau ni chargé depuis Internet.

import { app, BrowserWindow, dialog, Menu, screen, session, shell } from 'electron'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { courseHandler, DEFAULT_COURSES_DIR } from '../server/courseServer.ts'
import { migrateDataFiles } from '../server/userData.ts'

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

// Réglages de l'utilisateur (dossier du cours, fenêtre), à côté de ses données.
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
type Settings = { coursesDir?: string; window?: Electron.Rectangle & { maximized?: boolean } }
let settings: Settings = {}
try {
  settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
} catch {
  // Premier lancement (ou fichier abîmé) : on repart de zéro.
}
const saveSettings = () => writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))

let server: Server | undefined

/** Dossier du cours : celui mémorisé, sinon choisi dans un dialogue natif (puis mémorisé). */
async function chooseCoursesDir(): Promise<string | undefined> {
  if (process.env.COURSES_DIR) return process.env.COURSES_DIR
  if (settings.coursesDir && existsSync(settings.coursesDir)) return settings.coursesDir
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choisissez le dossier de votre cours de guitare',
    defaultPath: existsSync(DEFAULT_COURSES_DIR) ? DEFAULT_COURSES_DIR : undefined,
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths[0]) return undefined
  settings.coursesDir = filePaths[0]
  saveSettings()
  return filePaths[0]
}

/** Démarre le service local ; renvoie l'adresse racine de l'application. */
async function startServer(coursesDir: string): Promise<string> {
  // La progression vit dans le profil de l'utilisateur ; les anciens data/ (à côté de l'exécutable
  // ou du dossier de lancement) y sont repris une fois.
  const dataDir = path.join(app.getPath('userData'), 'data')
  await migrateDataFiles([path.join(path.dirname(process.execPath), 'data'), path.resolve('data')], dataDir)
  const handler = courseHandler(
    coursesDir,
    path.join(dataDir, 'progress.json'),
    path.join(dataDir, 'favorites.json'),
    path.join(dataDir, 'annotations.json'),
  )

  server = createServer((req, res) => {
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
    server!.once('error', reject)
    // Port libre, boucle locale seulement.
    server!.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`))
  })
}

/** Position mémorisée, si elle est encore visible sur un écran branché. */
function savedBounds(): Partial<Electron.Rectangle> {
  const { maximized: _maximized, ...bounds } = settings.window ?? ({} as NonNullable<Settings['window']>)
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return bounds.x! >= a.x && bounds.y! >= a.y && bounds.x! < a.x + a.width && bounds.y! < a.y + a.height
  })
  return visible ? bounds : { width: bounds.width, height: bounds.height }
}

async function createWindow() {
  let root = DEV_URL
  if (!root) {
    const coursesDir = await chooseCoursesDir()
    if (!coursesDir) return app.quit()
    root = await startServer(coursesDir)
  }
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    ...savedBounds(),
    backgroundColor: '#141414',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (settings.window?.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('close', () => {
    settings.window = { ...win.getNormalBounds(), maximized: win.isMaximized() }
    saveSettings()
  })

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
  // Fermeture propre : plus de connexion (vidéo en cours de lecture) ni d'écoute sur le port.
  app.on('will-quit', () => {
    server?.closeAllConnections()
    server?.close()
  })
}
