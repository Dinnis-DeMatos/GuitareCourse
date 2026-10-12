// Application de bureau Electron. Deux usages :
//   node scripts/electron.mjs dev     → serveur Vite + fenêtre Electron (rechargement à chaud)
//   node scripts/electron.mjs build   → types + Vite + installeur Windows dans release/ (rien n'est publié)

import { execFileSync, spawn } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'rolldown'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'build', 'electron')

/** Compile main et preload en CommonJS (Electron les charge tels quels) dans build/electron/. */
async function bundle() {
  mkdirSync(out, { recursive: true })
  for (const name of ['main', 'preload']) {
    await build({
      input: path.join(root, 'electron', `${name}.ts`),
      platform: 'node',
      external: ['electron', /^node:/],
      output: { file: path.join(out, `${name}.cjs`), format: 'cjs' },
    })
  }
  // L'application empaquetée a son propre package.json : tout son code est dans main.cjs, sans node_modules.
  const { name, version, description, author } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name, productName: 'GuitareCourse', version, description, author, main: 'main.cjs' }))
}

const mode = process.argv[2]
if (mode === 'dev') {
  await bundle()
  const { createServer } = await import('vite')
  const vite = await createServer({ root })
  await vite.listen()
  const { default: electron } = await import('electron')
  const url = vite.resolvedUrls.local[0]
  const child = spawn(electron, [out], { stdio: 'inherit', env: { ...process.env, ELECTRON_DEV_URL: url } })
  child.on('exit', async (code) => {
    await vite.close()
    process.exit(code ?? 0)
  })
} else if (mode === 'build') {
  const run = (script, args) => execFileSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit' })
  run('node_modules/typescript/bin/tsc', ['-b'])
  run('node_modules/vite/bin/vite.js', ['build'])
  await bundle()
  rmSync(path.join(out, 'dist'), { recursive: true, force: true })
  cpSync(path.join(root, 'dist'), path.join(out, 'dist'), { recursive: true })
  // « never » : l'installeur reste dans release/ ; la publication se fait à la main (voir le README).
  run('node_modules/electron-builder/cli.js', ['--win', '--publish', 'never', ...process.argv.slice(3)])
} else {
  console.error('Usage : node scripts/electron.mjs dev|build')
  process.exit(1)
}
