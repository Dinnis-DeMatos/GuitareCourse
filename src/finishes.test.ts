import { describe, expect, it } from 'vitest'
import { finishAt, finishByLesson, FINISHES } from './finishes.ts'
import type { Lesson, OutlineItem } from './lessons.ts'

const lesson = (id: string): Lesson => ({
  kind: 'lesson',
  id,
  title: id,
  context: '',
  video: { title: id, ext: 'mp4', kind: 'video', path: id, size: 1 },
  resources: [],
})

describe('finishAt', () => {
  it('suit le nuancier puis recommence', () => {
    expect(finishAt(0).id).toBe('fiesta')
    expect(finishAt(1).id).toBe('surf')
    expect(finishAt(FINISHES.length).id).toBe('fiesta')
  })
  it('ne propose que des finitions distinctes', () => {
    expect(new Set(FINISHES.map((finish) => finish.id)).size).toBe(FINISHES.length)
  })
})

describe('finishByLesson', () => {
  it('donne à chaque leçon la finition de son élément de premier niveau', () => {
    const outline: OutlineItem[] = [
      lesson('intro'),
      {
        kind: 'group',
        path: 'c1',
        name: 'Chapitre 1',
        items: [lesson('a'), { kind: 'group', path: 'c1/e1', name: 'Épisode 1', items: [lesson('b')] }],
      },
      { kind: 'group', path: 'c2', name: 'Chapitre 2', items: [lesson('c')] },
    ]
    const finishes = finishByLesson(outline)
    expect(finishes.get('intro')?.id).toBe('fiesta')
    expect(finishes.get('a')?.id).toBe('surf')
    expect(finishes.get('b')?.id).toBe('surf') // imbriquée : même chapitre, même finition
    expect(finishes.get('c')?.id).toBe('butterscotch')
  })
})
