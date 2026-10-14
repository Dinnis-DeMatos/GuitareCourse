// Pont exposé par l'application de bureau (electron/preload.ts) ; absent dans le navigateur.
type Desktop = { chooseCoursesDir: () => Promise<void> }

/** Ouvre le choix du dossier du cours ; null hors de l'application de bureau (le dossier se règle alors par COURSES_DIR). */
export const chooseCoursesDir: (() => void) | null =
  (window as unknown as { desktop?: Desktop }).desktop?.chooseCoursesDir ?? null
