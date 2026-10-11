import { readJson, updateJson } from './jsonStore.ts'

/** Favoris : chemins des vidéos des leçons mises de côté, sans doublon. */
export function readFavorites(file: string): Promise<string[]> {
  return readJson<string[]>(file, [])
}

/** Ajoute ou retire une leçon des favoris ; renvoie la liste à jour. */
export function setFavorite(file: string, videoPath: string, favorite: boolean): Promise<string[]> {
  return updateJson<string[]>(file, [], (list) => {
    const others = list.filter((path) => path !== videoPath)
    return favorite ? [...others, videoPath] : others
  })
}
