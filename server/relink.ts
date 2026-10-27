import type { AnnotationsMap, CourseFolder, ProgressMap } from '../src/courseTypes.ts'
import { readJson, updateJson } from './jsonStore.ts'

/** Taille en octets de chaque vidéo déjà vue, par chemin : de quoi la reconnaître si son chemin change. */
export type SizeMap = Record<string, number>

function videosOf(folder: CourseFolder): Map<string, number> {
  const videos = new Map<string, number>()
  const visit = (f: CourseFolder) => {
    for (const file of f.files) if (file.kind === 'video') videos.set(file.path, file.size)
    f.folders.forEach(visit)
  }
  visit(folder)
  return videos
}

/**
 * Ancien chemin → nouveau, pour les vidéos dont un dossier (ou le fichier) a été renommé ou déplacé : une
 * clé de données qui ne correspond plus à aucune vidéo va à la seule vidéo sans données de même taille et
 * de même extension. Au moindre doute (deux candidates, deux orphelines de même taille), rien ne bouge.
 */
export function findMoves(videos: Map<string, number>, sizes: SizeMap, keysWithData: Set<string>): Map<string, string> {
  const ext = (p: string) => p.slice(p.lastIndexOf('.')).toLowerCase()
  const slot = (size: number, p: string) => `${size}${ext(p)}`
  const group = (paths: Iterable<[string, number]>) => {
    const bySlot = new Map<string, string[]>()
    for (const [p, size] of paths) bySlot.set(slot(size, p), [...(bySlot.get(slot(size, p)) ?? []), p])
    return bySlot
  }
  const orphans = group([...keysWithData].filter((k) => !videos.has(k) && k in sizes).map((k) => [k, sizes[k]]))
  const free = group([...videos].filter(([p]) => !keysWithData.has(p)))

  const moves = new Map<string, string>()
  for (const [key, olds] of orphans) {
    const news = free.get(key)
    if (olds.length === 1 && news?.length === 1) moves.set(olds[0], news[0])
  }
  return moves
}

const renameKeys = <T>(all: Record<string, T>, moves: Map<string, string>) =>
  Object.fromEntries(Object.entries(all).map(([k, v]) => [moves.get(k) ?? k, v]))

/**
 * Rattache progression, favoris, notes et repères aux vidéos renommées ou déplacées (voir `findMoves`),
 * puis retient la taille des vidéos présentes. Celle d'une vidéo disparue est gardée tant qu'elle a des
 * données : un dossier débranché un moment les retrouvera à son retour.
 */
export async function relinkMoved(
  course: CourseFolder,
  sizesFile: string,
  progressFile: string,
  favoritesFile: string,
  annotationsFile: string,
): Promise<number> {
  const videos = videosOf(course)
  const [sizes, progress, favorites, annotations] = await Promise.all([
    readJson<SizeMap>(sizesFile, {}),
    readJson<ProgressMap>(progressFile, {}),
    readJson<string[]>(favoritesFile, []),
    readJson<AnnotationsMap>(annotationsFile, {}),
  ])
  const keys = new Set([...Object.keys(progress), ...favorites, ...Object.keys(annotations)])
  const moves = findMoves(videos, sizes, keys)

  if (moves.size > 0) {
    await updateJson<ProgressMap>(progressFile, {}, (all) => renameKeys(all, moves))
    await updateJson<string[]>(favoritesFile, [], (list) => [...new Set(list.map((k) => moves.get(k) ?? k))])
    await updateJson<AnnotationsMap>(annotationsFile, {}, (all) => renameKeys(all, moves))
  }

  // Les vidéos présentes, plus les disparues qui ont encore des données à leur rendre.
  const gone = Object.entries(sizes).filter(([p]) => !videos.has(p) && keys.has(p) && !moves.has(p))
  const next: SizeMap = { ...Object.fromEntries(gone), ...Object.fromEntries(videos) }
  if (JSON.stringify(Object.entries(next).sort()) !== JSON.stringify(Object.entries(sizes).sort())) {
    await updateJson<SizeMap>(sizesFile, {}, () => next)
  }
  return moves.size
}
