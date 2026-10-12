// Pont entre la fenêtre et Electron. L'application n'a besoin de rien pour l'instant : on n'expose
// que l'information « je tourne dans l'application de bureau », jamais d'accès à Node.

import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('desktop', { platform: process.platform })
