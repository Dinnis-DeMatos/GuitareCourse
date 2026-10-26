import type { CourseFile, CourseFolder, ProgressMap } from './courseTypes.ts'

/** Une leçon = une vidéo, avec les backing tracks et tablatures qui l'accompagnent. */
export interface Lesson {
  kind: 'lesson'
  /** Chemin de la vidéo : sert d'identifiant et de clé de progression. */
  id: string
  title: string
  /** Dossier d'où vient la leçon (« Partie A · Gagne en précision… »), pour situer la vidéo. */
  context: string
  video: CourseFile
  resources: CourseFile[]
}

export interface Group {
  kind: 'group'
  path: string
  name: string
  items: OutlineItem[]
}

export type OutlineItem = Lesson | Group

/**
 * Libellé lisible d'un nom de dossier : retire le numéro de tri et développe les abréviations
 * (« CHAP 1 » → « Chapitre 1 · », « Ep 2 » → « Épisode 2 · », « Part A » → « Partie A · »).
 */
export function cleanName(name: string): string {
  return name
    .replace(/^\d+\s+/, '')
    .replace(/^CHAP\s*(\d+)\s*/i, 'Chapitre $1 · ')
    .replace(/^Ep\s*(\d+)\s*/i, 'Épisode $1 · ')
    .replace(/^Part\s+([A-Za-z0-9]+)\b\s*[-–]?\s*/i, 'Partie $1 · ')
    .replace(/[\s·]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sépare « Épisode 1 · Apprends ton manche » en repère (« Épisode 1 ») et titre. */
export function splitName(label: string): { kicker: string | null; title: string } {
  const index = label.indexOf(' · ')
  return index === -1
    ? { kicker: null, title: label }
    : { kicker: label.slice(0, index), title: label.slice(index + 3) }
}

function hasVideo(folder: CourseFolder): boolean {
  return folder.files.some((file) => file.kind === 'video') || folder.folders.some(hasVideo)
}

/** Fichiers non vidéo d'un dossier, y compris ceux des sous-dossiers qui ne contiennent aucune vidéo. */
function resourceFiles(folder: CourseFolder): CourseFile[] {
  return [
    ...folder.files.filter((file) => file.kind !== 'video'),
    ...folder.folders.filter((sub) => !hasVideo(sub)).flatMap(resourceFiles),
  ]
}

function buildItems(folder: CourseFolder): OutlineItem[] {
  const resources = resourceFiles(folder)
  const context = cleanName(folder.name)
  const lessons: Lesson[] = folder.files
    .filter((file) => file.kind === 'video')
    .map((video) => ({ kind: 'lesson', id: video.path, title: video.title, context, video, resources }))
  const groups = folder.folders.filter(hasVideo).map(toItem)
  return [...lessons, ...groups]
}

function toItem(folder: CourseFolder): OutlineItem {
  const items = buildItems(folder)
  const name = cleanName(folder.name)
  // Un dossier qui ne contient qu'une vidéo n'a pas besoin de niveau en plus : la leçon suffit.
  // Sauf un épisode : il est toujours présenté comme une section, même avec une seule leçon.
  const episode = splitName(name).kicker?.startsWith('Épisode') ?? false
  if (items.length === 1 && items[0].kind === 'lesson' && !episode) return items[0]
  return { kind: 'group', path: folder.path, name, items }
}

/** Plan du cours : les groupes (chapitres, épisodes…) et leçons, dans l'ordre du dossier. */
export function buildOutline(root: CourseFolder): OutlineItem[] {
  return buildItems(root)
}

/**
 * Ce qui accompagne la vidéo : nombre de tablatures (une tablature en PDF, .gp et .gpx ne compte
 * qu'une fois) et de backing tracks.
 */
export function resourceSummary(lesson: Lesson): { tabs: number; backingTracks: number } {
  const tabTitles = new Set(lesson.resources.filter((file) => file.kind === 'tab').map((file) => file.title))
  return {
    tabs: tabTitles.size,
    backingTracks: lesson.resources.filter((file) => file.kind === 'audio').length,
  }
}

/** Une méthode de cours : un sous-dossier du dossier des méthodes, avec son plan et ses leçons. */
export interface Course {
  /** Chemin du dossier de la méthode (stable, sert d'identifiant). */
  id: string
  name: string
  outline: OutlineItem[]
  lessons: Lesson[]
}

/** Méthodes disponibles : chaque sous-dossier du dossier racine qui contient au moins une vidéo. */
export function listCourses(root: CourseFolder): Course[] {
  return root.folders.filter(hasVideo).map((folder) => {
    const outline = buildOutline(folder)
    return { id: folder.path, name: folder.name, outline, lessons: lessonsOf(outline) }
  })
}

/** Toutes les leçons, dans l'ordre de lecture. */
export function lessonsOf(items: OutlineItem[]): Lesson[] {
  return items.flatMap((item) => (item.kind === 'lesson' ? [item] : lessonsOf(item.items)))
}

/** Groupes qui contiennent la leçon `id`, du plus large au plus proche ; null si elle n'existe pas. */
export function groupsTo(items: OutlineItem[], id: string): Group[] | null {
  for (const item of items) {
    if (item.kind === 'lesson') {
      if (item.id === id) return []
    } else {
      const inside = groupsTo(item.items, id)
      if (inside) return [item, ...inside]
    }
  }
  return null
}

/**
 * Fil d'Ariane d'une leçon : « Chapitre 1 », « Épisode 2 », « Partie D ». On ne garde que le repère
 * de chaque niveau (le titre complet serait trop long), et le dossier de la leçon seulement s'il
 * apprend quelque chose de plus que son titre.
 */
export function lessonCrumbs(items: OutlineItem[], lesson: Lesson): string[] {
  const crumbs = (groupsTo(items, lesson.id) ?? []).map((group) => splitName(group.name).kicker ?? group.name)
  const own = splitName(lesson.context)
  const last = own.kicker ?? own.title
  if (last.toLowerCase() !== lesson.title.toLowerCase() && !crumbs.includes(last)) crumbs.push(last)
  return crumbs
}

export function countLessons(items: OutlineItem[], progress: ProgressMap): { done: number; total: number } {
  const lessons = lessonsOf(items)
  return { done: lessons.filter((lesson) => progress[lesson.id]?.completed).length, total: lessons.length }
}

/** Leçon à proposer à l'ouverture : la dernière entamée, sinon la première pas terminée. */
export function pickStartLesson(lessons: Lesson[], progress: ProgressMap): Lesson | undefined {
  const started = lessons
    .filter((lesson) => {
      const entry = progress[lesson.id]
      return entry && !entry.completed && entry.position > 0
    })
    .sort((a, b) => progress[b.id].updatedAt.localeCompare(progress[a.id].updatedAt))
  return started[0] ?? lessons.find((lesson) => !progress[lesson.id]?.completed) ?? lessons[0]
}
