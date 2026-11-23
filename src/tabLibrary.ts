import type { CourseFile, CourseFolder } from './courseTypes.ts'

/** Une partition du dossier des tablatures, avec les sous-dossiers qui y mènent. */
export interface LibraryScore {
  file: CourseFile
  crumbs: string[]
}

/**
 * Les partitions Guitar Pro du dossier, sous-dossiers compris, dans l'ordre du dossier. Un .gp et un .gpx
 * de même nom peuvent être deux versions différentes (tempo…) : les deux sont gardés.
 */
export function listScores(folder: CourseFolder, crumbs: string[] = []): LibraryScore[] {
  const own = folder.files
    .filter((file) => file.ext === 'gp' || file.ext === 'gpx')
    .map((file) => ({ file, crumbs }))
  return [...own, ...folder.folders.flatMap((sub) => listScores(sub, [...crumbs, sub.name]))]
}

/** Texte comparable : sans accents ni majuscules. */
export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Les mots d'une recherche, comparables. */
export const wordsOf = (query: string) => fold(query).split(/\s+/).filter(Boolean)

/** Vrai si le texte contient chacun des mots (venus de `wordsOf`). */
export const matchesWords = (words: string[], text: string) => {
  const folded = fold(text)
  return words.every((word) => folded.includes(word))
}

/** Garde les partitions dont le titre ou un dossier contient chaque mot cherché (sans tenir compte des accents). */
export function filterScores(scores: LibraryScore[], query: string): LibraryScore[] {
  const words = wordsOf(query)
  return scores.filter((score) => matchesWords(words, [score.file.title, ...score.crumbs].join(' ')))
}

/** Adresse d'un fichier du dossier des tablatures, servi par le serveur local. */
export function tabUrl(file: CourseFile): string {
  return '/tabs/' + file.path.split('/').map(encodeURIComponent).join('/')
}
