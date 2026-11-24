// Pont entre la fenêtre et Electron : la plateforme, la demande de changer le dossier du cours ou des tablatures, le thème, les boutons de la fenêtre, la version du
// lancement précédent.
// Jamais d'accès à Node.

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  chooseCoursesDir: () => ipcRenderer.invoke('choose-courses-dir') as Promise<void>,
  chooseTabsDir: () => ipcRenderer.invoke('choose-tabs-dir') as Promise<boolean>,
  setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('set-theme', theme) as Promise<void>,
  setFinish: (finish: string) => ipcRenderer.invoke('set-finish', finish) as Promise<void>,
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.invoke('window-control', action) as Promise<void>,
  previousVersion: () => ipcRenderer.invoke('previous-version') as Promise<string | null>,
})
