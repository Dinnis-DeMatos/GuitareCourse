// Pont exposé par l'application de bureau (electron/preload.ts) ; absent dans le navigateur.
type Desktop = {
  chooseCoursesDir: () => Promise<void>
  chooseTabsDir: () => Promise<boolean>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
  setFinish: (finish: string) => Promise<void>
  windowControl: (action: WindowAction) => Promise<void>
  previousVersion: () => Promise<string | null>
}

export type WindowAction = 'minimize' | 'maximize' | 'close'

const desktop = (window as unknown as { desktop?: Desktop }).desktop

/** Ouvre le choix du dossier du cours ; null hors de l'application de bureau (le dossier se règle alors par COURSES_DIR). */
export const chooseCoursesDir: (() => void) | null = desktop?.chooseCoursesDir ?? null

/** Ouvre le choix du dossier des tablatures (vrai si un dossier est choisi) ; null hors de l'application de bureau (TABS_DIR). */
export const chooseTabsDir: (() => Promise<boolean>) | null = desktop?.chooseTabsDir ?? null

/** Envoyé sur window quand un autre dossier de tablatures est choisi : la page des tablatures se relit. */
export const TABS_DIR_CHANGED = 'guitarecourse:tabs-dir'

/** Choisit le dossier des tablatures et prévient la page des tablatures ; null hors de l'application de bureau. */
export const changeTabsDir: (() => Promise<boolean>) | null =
  chooseTabsDir &&
  (async () => {
    const chosen = await chooseTabsDir()
    if (chosen) window.dispatchEvent(new Event(TABS_DIR_CHANGED))
    return chosen
  })

/** Réduit, agrandit (ou restaure) ou ferme la fenêtre ; null dans le navigateur, qui a ses propres boutons. */
export const windowControl: ((action: WindowAction) => void) | null =
  desktop ? (action) => void desktop.windowControl(action) : null

/** Transmet le thème à l'application de bureau (fenêtre de mise à jour) ; sans effet dans le navigateur. */
export const setDesktopTheme: (theme: 'dark' | 'light') => void = (theme) => void desktop?.setTheme(theme)

/** Transmet la couleur de l'application (#rrggbb) à l'application de bureau (fenêtre de mise à jour). */
export const setDesktopFinish: (finish: string) => void = (finish) => void desktop?.setFinish(finish)

/**
 * Version du lancement précédent, si l'application vient d'être mise à jour ('' : inconnue) ; null sinon,
 * au premier lancement et dans le navigateur.
 */
export const previousVersion = (): Promise<string | null> => desktop?.previousVersion() ?? Promise.resolve(null)
