import { alphaTab } from '@coderline/alphatab-vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { courseServer } from './server/courseServer.ts'

// https://vite.dev/config/
export default defineConfig({
  // alphaTab : ses workers, et ses polices et sa banque de sons copiées dans /font et /soundfont.
  plugins: [react(), alphaTab(), courseServer()],
  // La version affichée dans « À propos » et « Quoi de neuf » (src/version.ts).
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version) },
  // Port propre à GuitareCourse : 5173 (défaut de Vite) est pris par Comptelpe.
  server: {
    port: 5174,
    strictPort: true,
    // Les dossiers de construction ne sont pas surveillés : le serveur y garderait des dossiers ouverts,
    // et `npm run release` ne pourrait plus les renommer (EPERM).
    watch: { ignored: ['**/release/**', '**/build/**'] },
  },
  preview: { port: 4174, strictPort: true },
})
