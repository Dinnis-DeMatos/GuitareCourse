// Pont exposé par l'application de bureau (electron/preload.ts) ; absent dans le navigateur.
type Desktop = { chooseCoursesDir: () => Promise<void>; setTheme: (theme: 'dark' | 'light') => Promise<void> }

const desktop = (window as unknown as { desktop?: Desktop }).desktop

/** Ouvre le choix du dossier du cours ; null hors de l'application de bureau (le dossier se règle alors par COURSES_DIR). */
export const chooseCoursesDir: (() => void) | null = desktop?.chooseCoursesDir ?? null

/** Transmet le thème à l'application de bureau (fenêtre de mise à jour) ; sans effet dans le navigateur. */
export const setDesktopTheme: (theme: 'dark' | 'light') => void = (theme) => void desktop?.setTheme(theme)
