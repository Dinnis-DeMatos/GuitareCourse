import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { courseServer } from './server/courseServer.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), courseServer()],
})
