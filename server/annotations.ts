import type { AnnotationsMap, Bookmark, LessonAnnotations } from '../src/courseTypes.ts'
import { MAX_BOOKMARKS, MAX_NOTES_LENGTH } from '../src/limits.ts'
import { readJson, updateJson } from './jsonStore.ts'

export function readAnnotations(file: string): Promise<AnnotationsMap> {
  return readJson<AnnotationsMap>(file, {})
}

const isSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function parseBookmark(value: unknown): Bookmark | null {
  if (typeof value !== 'object' || value === null) return null
  const { id, time, end, label } = value as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return null
  if (!isSeconds(time) || typeof label !== 'string' || label.length > 200) return null
  if (end === undefined) return { id, time, label }
  return isSeconds(end) && end > time ? { id, time, end, label } : null
}

/** Valide les annotations reçues du navigateur ; renvoie null si elles sont incorrectes. */
export function parseAnnotations(value: unknown): LessonAnnotations | null {
  if (typeof value !== 'object' || value === null) return null
  const { notes, bookmarks } = value as Record<string, unknown>
  if (typeof notes !== 'string' || notes.length > MAX_NOTES_LENGTH) return null
  if (!Array.isArray(bookmarks) || bookmarks.length > MAX_BOOKMARKS) return null
  const parsed = bookmarks.map(parseBookmark)
  if (parsed.some((bookmark) => bookmark === null)) return null
  return { notes, bookmarks: parsed as Bookmark[] }
}

/** Remplace les annotations d'une leçon ; des annotations vides suppriment l'entrée. */
export async function saveAnnotations(
  file: string,
  videoPath: string,
  annotations: LessonAnnotations,
): Promise<void> {
  const isEmpty = annotations.notes.trim() === '' && annotations.bookmarks.length === 0
  await updateJson<AnnotationsMap>(file, {}, (all) => {
    const { [videoPath]: _removed, ...others } = all
    return isEmpty ? others : { ...others, [videoPath]: annotations }
  })
}
