// Fabrique GuitareCourse.exe : l'application construite et son serveur local, réunis dans un seul
// exécutable (« Single Executable Application » de Node). Lancer : npm run build:exe
//
// L'exécutable embarque Node (~90 Mo) : il ne demande rien d'installé. Ses données (progression,
// favoris, notes) sont dans le dossier data/ à côté de lui.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, openSync, readdirSync, readSync, closeSync, writeFileSync, writeSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'rolldown'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (script, args) => execFileSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit' })
const outDir = path.join(root, 'build')
const exe = path.join(root, 'GuitareCourse.exe')

console.log('1/5 Application (types + Vite)')
run('node_modules/typescript/bin/tsc', ['-b'])
run('node_modules/vite/bin/vite.js', ['build'])

console.log('2/5 Serveur (un seul fichier)')
mkdirSync(outDir, { recursive: true })
await build({
  input: path.join(root, 'server/standalone.ts'),
  platform: 'node',
  external: [/^node:/],
  output: { file: path.join(outDir, 'server.cjs'), format: 'cjs' },
})

console.log('3/5 Fichiers embarqués')
const assets = {}
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else assets[path.relative(path.join(root, 'dist'), full).split(path.sep).join('/')] = full
  }
}
walk(path.join(root, 'dist'))
const config = path.join(outDir, 'sea-config.json')
const blob = path.join(outDir, 'sea.blob')
writeFileSync(
  config,
  JSON.stringify({ main: path.join(outDir, 'server.cjs'), output: blob, disableExperimentalSEAWarning: true, assets }),
)
execFileSync(process.execPath, ['--experimental-sea-config', config], { cwd: root, stdio: 'inherit' })

console.log('4/5 Exécutable')
copyFileSync(process.execPath, exe)
run('node_modules/postject/dist/cli.js', [
  exe,
  'NODE_SEA_BLOB',
  blob,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
])

// Application fenêtrée : sans cela, Windows ouvrirait une console noire à chaque lancement.
console.log('5/5 Sans console')
const fd = openSync(exe, 'r+')
const header = Buffer.alloc(4)
readSync(fd, header, 0, 4, 0x3c)
const subsystem = header.readUInt32LE(0) + 24 + 68 // en-tête PE + en-tête optionnel, champ « Subsystem »
writeSync(fd, Buffer.from([2, 0]), 0, 2, subsystem) // 2 = interface graphique Windows
closeSync(fd)

console.log(`OK : ${exe} (${Math.round(statSync(exe).size / 1048576)} Mo)`)
