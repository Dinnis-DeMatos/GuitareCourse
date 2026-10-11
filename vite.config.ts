import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { courseServer } from './server/courseServer.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), courseServer()],
  // Port propre à GuitareCourse : 5173 (défaut de Vite) est pris par Comptelpe.
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
})
