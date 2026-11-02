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

/** Garde les partitions dont le titre ou un dossier contient chaque mot cherché (sans tenir compte des accents). */
export function filterScores(scores: LibraryScore[], query: string): LibraryScore[] {
  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  return scores.filter((score) => {
    const text = fold([score.file.title, ...score.crumbs].join(' '))
    return words.every((word) => text.includes(word))
  })
}

/** Adresse d'un fichier du dossier des tablatures, servi par le serveur local. */
export function tabUrl(file: CourseFile): string {
  return '/tabs/' + file.path.split('/').map(encodeURIComponent).join('/')
}
