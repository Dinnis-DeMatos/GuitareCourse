// Fabrique electron/icon.ico (icône de l'application et de l'installeur) à partir de public/favicon.svg.
// À relancer seulement si le favicon change : npm run electron:icon
// Electron sert ici de moteur de rendu SVG : aucune dépendance de plus.

import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

app.disableHardwareAcceleration()
// Pas de « await » ici : Electron attend la fin de ce module avant de se déclarer prêt.
void app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } })
  const svg = readFileSync(path.join(root, 'public', 'favicon.svg'), 'utf8')
  const page = `<body style="margin:0;background:transparent;overflow:hidden">${svg.replace('<svg ', '<svg width="256" height="256" ')}`
  // Hors écran, l'image arrive par l'événement « paint » (la dernière reçue est la page chargée).
  let image
  win.webContents.on('paint', (_event, _dirty, painted) => (image = painted))
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const pngs = SIZES.map((size) => image.resize({ width: size, height: size, quality: 'best' }).toPNG())

  // Format ICO : en-tête (6 octets), une entrée de 16 octets par taille, puis les PNG tels quels.
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(1, 2) // type : icône
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach((png, index) => {
    const entry = 6 + 16 * index
    header.writeUInt8(SIZES[index] % 256, entry) // largeur (0 = 256)
    header.writeUInt8(SIZES[index] % 256, entry + 1) // hauteur
    header.writeUInt16LE(1, entry + 4) // plans
    header.writeUInt16LE(32, entry + 6) // bits par pixel
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  writeFileSync(path.join(root, 'electron', 'icon.ico'), Buffer.concat([header, ...pngs]))
  app.quit()
})
