// Processus principal de l'application de bureau : le même service que le serveur de développement
// (courseHandler) tourne sur cet ordinateur uniquement, sur un port libre, et sert aussi l'application
// construite à la fenêtre. Rien n'est exposé au réseau ni chargé depuis Internet.

import { app, BrowserWindow, dialog, ipcMain, Menu, screen, session, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { courseHandler, DEFAULT_COURSES_DIR } from '../server/courseServer.ts'
import { BACKGROUND, installingScript, SPLASH_SIZE, splashPage, type Theme } from './splash.ts'

// Lancé par `npm run electron:dev` : on charge le serveur Vite (rechargement à chaud) plutôt que l'app construite.
const DEV_URL = process.env.ELECTRON_DEV_URL
// Dossier de l'application construite : à côté de ce fichier une fois empaquetée, sinon dist/ du projet.
const DIST = app.isPackaged ? path.join(__dirname, 'dist') : path.resolve('dist')

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', // le moteur de pdf.js qui dessine les tablatures
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', // la police des partitions Guitar Pro (alphaTab)
}

// Réglages de l'utilisateur (dossier du cours, fenêtre), à côté de ses données.
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
type Settings = { coursesDir?: string; tabsDir?: string; theme?: Theme; finish?: string; seenVersion?: string; port?: number; window?: Electron.Rectangle & { maximized?: boolean } }
let settings: Settings = {}
try {
  settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
} catch {
  // Premier lancement (ou fichier abîmé) : on repart de zéro.
}
// Fichier temporaire puis renommage : une coupure en pleine écriture ne laisse jamais un fichier abîmé,
// qui ferait perdre le port, donc tous les réglages de la fenêtre (rangés par adresse).
const saveSettings = () => {
  writeFileSync(`${SETTINGS_FILE}.tmp`, JSON.stringify(settings, null, 2))
  renameSync(`${SETTINGS_FILE}.tmp`, SETTINGS_FILE)
}

// Présent pendant l'installation d'une mise à jour : la fenêtre d'installation (splash.ts) reste affichée
// tant qu'il existe ; la nouvelle version l'efface une fois sa fenêtre ouverte.
const INSTALLING = path.join(app.getPath('userData'), 'update-installing')

// Version du lancement précédent : une autre juste après une mise à jour, pour présenter les nouveautés.
// Inconnue chez qui utilisait déjà l'application avant qu'on la retienne (''), absente au premier lancement.
let previousVersion = settings.seenVersion ?? (settings.coursesDir ? '' : null)

let server: Server | undefined

/** Dialogue natif de choix du dossier du cours ; le choix est mémorisé. */
async function pickCoursesDir(title: string): Promise<string | undefined> {
  const start = [settings.coursesDir, DEFAULT_COURSES_DIR].find((d) => d && existsSync(d))
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title,
    defaultPath: start,
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths[0]) return undefined
  settings.coursesDir = filePaths[0]
  saveSettings()
  return filePaths[0]
}

/** Dossier du cours : celui mémorisé, sinon (premier lancement, dossier déplacé) choisi par l'utilisateur. */
async function chooseCoursesDir(): Promise<string | undefined> {
  if (process.env.COURSES_DIR) return process.env.COURSES_DIR
  if (settings.coursesDir && existsSync(settings.coursesDir)) return settings.coursesDir
  if (settings.coursesDir) {
    await dialog.showMessageBox({
      type: 'warning',
      message: 'Le dossier du cours est introuvable.',
      detail: `${settings.coursesDir}\n\nIl a peut-être été déplacé ou renommé. Choisissez son nouvel emplacement.`,
    })
  }
  return pickCoursesDir('Choisissez le dossier de votre cours de guitare')
}

/** Démarre le service local ; renvoie l'adresse racine de l'application. */
async function startServer(coursesDir: string): Promise<string> {
  // La progression vit dans le profil de l'utilisateur.
  const dataDir = path.join(app.getPath('userData'), 'data')
  const handler = courseHandler(coursesDir, dataDir, () => settings.tabsDir)

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
  // Toujours le même port, boucle locale seulement : la fenêtre range ses réglages (couleur, volumes,
  // métronome, manche…) par adresse, et un autre port les lui ferait oublier. S'il est pris par un autre
  // programme, on en prend un libre, retenu pour les lancements suivants.
  const listen = (port: number) =>
    new Promise<number>((resolve, reject) => {
      server!.once('error', reject)
      server!.listen(port, '127.0.0.1', () => {
        server!.off('error', reject)
        resolve((server!.address() as AddressInfo).port)
      })
    })
  const port = await (settings.port ? listen(settings.port).catch(() => listen(0)) : listen(0))
  if (port !== settings.port) {
    settings.port = port
    saveSettings()
  }
  return `http://127.0.0.1:${port}`
}

/**
 * Au démarrage : si une version plus récente est publiée, elle est téléchargée et installée avant
 * d'ouvrir l'application, qui se relance d'elle-même à jour. Renvoie vrai si l'installation est lancée.
 * Hors ligne, sans réponse rapide de GitHub ou en cas d'échec, l'application démarre normalement.
 */
async function updateBeforeStart(): Promise<boolean> {
  if (!app.isPackaged) return false
  autoUpdater.autoDownload = false
  const tooSlow = new Promise<null>((resolve) => setTimeout(resolve, 8000, null))
  const check = await Promise.race([autoUpdater.checkForUpdates(), tooSlow]).catch(() => null)
  if (!check?.isUpdateAvailable) return false

  const theme = settings.theme ?? 'dark'
  const version = check.updateInfo.version
  // Transparente : la page dessine une fenêtre aux coins arrondis, comme celles de l'application.
  const splash = new BrowserWindow({ ...SPLASH_SIZE, frame: false, transparent: true, resizable: false, show: false })
  const page = splashPage(version, theme, settings.finish)
  await splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
  splash.show()
  autoUpdater.on('download-progress', ({ percent }) => {
    if (splash.isDestroyed()) return
    splash.setProgressBar(percent / 100)
    void splash.webContents.executeJavaScript(`progress(${Number(percent)})`)
  })
  try {
    await autoUpdater.downloadUpdate()
  } catch {
    // Fermée seulement une fois la fenêtre principale créée : sans aucune fenêtre, l'application quitterait.
    splash.hide()
    app.once('browser-window-created', () => splash.destroy())
    return false
  }
  // L'application se ferme pour s'installer : une fenêtre Windows identique prend le relais à la même place,
  // jusqu'à l'ouverture de la nouvelle version (createWindow). Sans elle (PowerShell absent…), on installe quand même.
  void splash.webContents.executeJavaScript('installing()')
  try {
    writeFileSync(INSTALLING, '')
    const script = `${INSTALLING}.ps1`
    // Avec BOM : sans lui, Windows PowerShell lit le script en ANSI et les accents s'abîment.
    writeFileSync(script, `﻿${installingScript(version, theme, settings.finish, splash.getBounds(), INSTALLING)}`)
    const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    helper.on('error', () => undefined)
    helper.unref()
    for (let waited = 0; waited < 5000 && !existsSync(`${INSTALLING}.shown`); waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } catch {
    // Pas de fenêtre pendant l'installation : la mise à jour se fait tout de même.
  }
  // Installation silencieuse, puis relance de l'application à jour.
  autoUpdater.quitAndInstall(true, true)
  return true
}

/** Position mémorisée, si elle est encore visible sur un écran branché. */
function savedBounds(): Partial<Electron.Rectangle> {
  // Premier lancement : rien à reprendre (des dimensions « undefined » écraseraient celles par défaut).
  if (!settings.window) return {}
  const { maximized: _maximized, ...bounds } = settings.window
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return bounds.x >= a.x && bounds.y >= a.y && bounds.x < a.x + a.width && bounds.y < a.y + a.height
  })
  return visible ? bounds : { width: bounds.width, height: bounds.height }
}

/**
 * Sans barre de titre, isMaximized() reste vrai après une restauration (Windows) : on compare plutôt la
 * taille de la fenêtre à celle de l'écran.
 */
function isMaximized(win: BrowserWindow): boolean {
  const bounds = win.getBounds()
  const area = screen.getDisplayMatching(bounds).workArea
  return bounds.width >= area.width && bounds.height >= area.height
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
    backgroundColor: BACKGROUND[settings.theme ?? 'dark'],
    // Sans barre de titre : la page dessine ses propres boutons de fenêtre (WindowControls.tsx).
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,    },
  })
  settings.seenVersion = app.getVersion()
  saveSettings()
  if (settings.window?.maximized) win.maximize()
  win.once('ready-to-show', () => {
    win.show()
    // Juste après une mise à jour : la fenêtre d'installation se ferme, la nouvelle version est là.
    rmSync(INSTALLING, { force: true })
    rmSync(`${INSTALLING}.ps1`, { force: true })
  })
  // Avant de fermer, la séance d'exercice en cours est enregistrée (3 s d'attente au plus) : sans cela, le
  // service local s'arrête avec l'application avant d'avoir reçu la séance.
  let sessionSaved = false
  win.on('close', (event) => {
    settings.window = { ...win.getNormalBounds(), maximized: isMaximized(win) }
    saveSettings()
    if (sessionSaved) return
    event.preventDefault()
    sessionSaved = true
    const save = win.webContents.executeJavaScript('window.saveTrainerSession?.()', true)
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000))
    void Promise.race([save, timeout])
      .catch(() => undefined)
      .finally(() => win.close())
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
  // Même identifiant que l'installeur (package.json, build.appId) : sans lui, Windows n'affiche pas la notification.
  app.setAppUserModelId('io.github.dinnis-dematos.guitarecourse')
  // Changer de dossier : le service est lié à l'ancien, on relance l'application avec le nouveau.
  // Thème choisi dans l'application : repris par la fenêtre de mise à jour et le fond des fenêtres.
  ipcMain.handle('set-theme', (_event, theme: unknown) => {
    if ((theme !== 'dark' && theme !== 'light') || settings.theme === theme) return
    settings.theme = theme
    saveSettings()
  })
  // La couleur choisie dans l'application, pour la fenêtre de mise à jour.
  ipcMain.handle('set-finish', (_event, finish: unknown) => {
    if (typeof finish !== 'string' || !/^#[0-9a-f]{6}$/.test(finish) || settings.finish === finish) return
    settings.finish = finish
    saveSettings()
  })
  // Les boutons de fenêtre dessinés par la page.
  ipcMain.handle('window-control', (event, action: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (action === 'minimize') win?.minimize()
    else if (action === 'maximize' && win && isMaximized(win)) win.unmaximize()
    else if (action === 'maximize') win?.maximize()
    else if (action === 'close') win?.close()
  })
  // Une seule réponse par lancement : la fenêtre « Quoi de neuf » est recréée à chaque passage entre
  // l'accueil et une leçon, et ne doit s'ouvrir qu'une fois.
  ipcMain.handle('previous-version', () => {
    const previous = previousVersion === app.getVersion() ? null : previousVersion
    previousVersion = null
    return previous
  })
  ipcMain.handle('choose-courses-dir', async () => {
    if (!(await pickCoursesDir('Choisissez le dossier de votre cours de guitare'))) return
    app.relaunch()
    app.exit(0)
  })
  // Le dossier des tablatures, lui, est relu à chaque demande : pas besoin de relancer.
  ipcMain.handle('choose-tabs-dir', async () => {
    const start = [settings.tabsDir, settings.coursesDir].find((d) => d && existsSync(d))
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choisissez le dossier de vos tablatures',
      defaultPath: start,
      properties: ['openDirectory'],
    })
    if (canceled || !filePaths[0]) return false
    settings.tabsDir = filePaths[0]
    saveSettings()
    return true
  })
  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    // Seul le plein écran (bouton du lecteur) est accordé ; ni caméra, micro ni notifications.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'fullscreen' || permission === 'media'))
    // Mises à jour (GitHub Releases) : installées avant d'ouvrir l'application.
    if (await updateBeforeStart()) return
    return createWindow()
  })
  app.on('window-all-closed', () => app.quit())
  // Fermeture propre : plus de connexion (vidéo en cours de lecture) ni d'écoute sur le port.
  app.on('will-quit', () => {
    server?.closeAllConnections()
    server?.close()
  })
}
