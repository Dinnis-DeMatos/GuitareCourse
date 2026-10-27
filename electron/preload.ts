// Pont entre la fenêtre et Electron : la plateforme, la demande de changer le dossier du cours, le thème, la version du
// lancement précédent.
// Jamais d'accès à Node.

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  chooseCoursesDir: () => ipcRenderer.invoke('choose-courses-dir') as Promise<void>,
  setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('set-theme', theme) as Promise<void>,
  previousVersion: () => ipcRenderer.invoke('previous-version') as Promise<string | null>,
})
