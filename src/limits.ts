// Limites partagées entre le navigateur et le serveur local.

export const MAX_NOTES_LENGTH = 20_000
export const MAX_BOOKMARKS = 200

/** Bornes du tempo : le métronome, et le tempo noté dans le carnet d'accords. */
export const MIN_BPM = 30
export const MAX_BPM = 250

/** Temps par mesure proposés (métronome, rythmique du carnet) ; le premier temps de chaque mesure est accentué. */
export const BEATS = [2, 3, 4, 6] as const
