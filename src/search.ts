import type { AnnotationsMap, Bookmark, ChordProgression } from './courseTypes.ts'
import type { Course, Lesson } from './lessons.ts'
import { filterRoutines, type Routine } from './routines.ts'
import { filterScores, fold, type LibraryScore } from './tabLibrary.ts'
import { filterTones, type Tone } from './tones.ts'

// Recherche dans toute l'application : leçons, notes, repères, puis ce qu'on a rangé dans les outils.

export type SearchTarget =
  | { kind: 'lesson'; lesson: Lesson }
  | { kind: 'note'; lesson: Lesson }
  | { kind: 'mark'; lesson: Lesson; mark: Bookmark }
  | { kind: 'chords'; progression: ChordProgression }
  | { kind: 'routine'; routine: Routine }
  | { kind: 'tone'; tone: Tone }
  | { kind: 'tab'; score: LibraryScore }

export interface SearchHit {
  key: string
  title: string
  /** D'où vient le résultat (méthode, leçon, extrait de la note…). */
  detail: string
  target: SearchTarget
}

export interface SearchSources {
  courses: Course[]
  annotations: AnnotationsMap
  /** null tant que l'outil n'a pas été lu. */
  progressions: ChordProgression[] | null
  routines: Routine[] | null
  tones: Tone[] | null
  scores: LibraryScore[] | null
}

/** Résultats montrés par sorte : au-delà, on demande d'affiner, et les autres sortes restent en vue. */
export const MAX_PER_KIND = 10

const wordsOf = (query: string) => fold(query).split(/\s+/).filter(Boolean)
const matches = (words: string[], text: string) => {
  const folded = fold(text)
  return words.every((word) => folded.includes(word))
}

/** La ligne de la note où apparaît le premier mot cherché, raccourcie. */
export function excerpt(notes: string, words: string[]): string {
  const lines = notes.split('\n').map((line) => line.trim()).filter(Boolean)
  const line = lines.find((l) => fold(l).includes(words[0] ?? '')) ?? lines[0] ?? ''
  return line.length > 90 ? line.slice(0, 89) + '…' : line
}

export function search(sources: SearchSources, query: string): SearchHit[] {
  const words = wordsOf(query)
  if (words.length === 0) return []
  const hits: SearchHit[] = []
  const lessons = sources.courses.flatMap((course) => course.lessons.map((lesson) => ({ course, lesson })))

  for (const { course, lesson } of lessons) {
    const text = [lesson.title, lesson.context, course.name, ...lesson.resources.map((r) => r.title)].join(' ')
    if (matches(words, text))
      hits.push({ key: 'l:' + lesson.id, title: lesson.title, detail: [course.name, lesson.context].filter(Boolean).join(' · '), target: { kind: 'lesson', lesson } })
  }
  for (const { lesson } of lessons) {
    const notes = sources.annotations[lesson.id]?.notes ?? ''
    if (notes && matches(words, notes))
      hits.push({ key: 'n:' + lesson.id, title: excerpt(notes, words), detail: lesson.title, target: { kind: 'note', lesson } })
  }
  for (const { lesson } of lessons) {
    for (const mark of sources.annotations[lesson.id]?.bookmarks ?? [])
      if (matches(words, mark.label))
        hits.push({ key: `m:${lesson.id}:${mark.id}`, title: mark.label, detail: lesson.title, target: { kind: 'mark', lesson, mark } })
  }
  for (const progression of sources.progressions ?? []) {
    if (matches(words, [progression.name, ...progression.chords, progression.notes].join(' ')))
      hits.push({ key: 'c:' + progression.id, title: progression.name || 'Suite sans nom', detail: progression.chords.join(' '), target: { kind: 'chords', progression } })
  }
  for (const routine of filterRoutines(sources.routines ?? [], query))
    hits.push({ key: 'r:' + routine.id, title: routine.name, detail: routine.steps.map((s) => s.name).join(' · '), target: { kind: 'routine', routine } })
  for (const tone of filterTones(sources.tones ?? [], query))
    hits.push({ key: 's:' + tone.id, title: tone.name, detail: [tone.artist, tone.amp].filter(Boolean).join(' · '), target: { kind: 'tone', tone } })
  for (const score of filterScores(sources.scores ?? [], query))
    hits.push({ key: 't:' + score.file.path, title: score.file.title, detail: score.crumbs.join(' / ') || 'Tablatures', target: { kind: 'tab', score } })

  return hits
}
