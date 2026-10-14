// Pont entre la fenêtre et Electron : la plateforme, et la demande de changer le dossier du cours.
// Jamais d'accès à Node.

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  chooseCoursesDir: () => ipcRenderer.invoke('choose-courses-dir') as Promise<void>,
})
