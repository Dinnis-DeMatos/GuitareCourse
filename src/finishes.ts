import { lessonsOf, type OutlineItem } from './lessons.ts'

/**
 * Le nuancier de l'application : des finitions de guitares des années 60 (« custom colors »).
 * Chaque élément de premier niveau du plan (un chapitre, le plus souvent) reçoit la sienne, dans
 * l'ordre ; elle colore son bandeau, ses leçons et les commandes du lecteur. Les couleurs elles-mêmes
 * sont dans styles/tokens.css, sous le même identifiant.
 */
export const FINISHES = [
  { id: 'fiesta', name: 'Fiesta Red' },
  { id: 'surf', name: 'Surf Green' },
  { id: 'butterscotch', name: 'Butterscotch' },
  { id: 'daphne', name: 'Daphne Blue' },
  { id: 'shell', name: 'Shell Pink' },
  { id: 'turquoise', name: 'Ocean Turquoise' },
] as const

export type Finish = (typeof FINISHES)[number]

/** Finition du n-ième élément du plan ; le nuancier recommence quand il est épuisé. */
export function finishAt(index: number): Finish {
  return FINISHES[index % FINISHES.length]
}

/** Finition de chaque leçon : celle de l'élément de premier niveau qui la contient. */
export function finishByLesson(outline: OutlineItem[]): Map<string, Finish> {
  const finishes = new Map<string, Finish>()
  outline.forEach((item, index) => {
    const finish = finishAt(index)
    for (const lesson of item.kind === 'lesson' ? [item] : lessonsOf(item.items)) finishes.set(lesson.id, finish)
  })
  return finishes
}
