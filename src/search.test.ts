import { describe, expect, it } from 'vitest'
import type { CourseFile } from './courseTypes.ts'
import type { Course, Lesson } from './lessons.ts'
import { excerpt, search, type SearchSources } from './search.ts'

const video = (path: string): CourseFile => ({ title: path, ext: 'mp4', kind: 'video', path, size: 1 })
const lesson = (id: string, title: string): Lesson => ({ kind: 'lesson', id, title, context: 'Chapitre 1', video: video(id), resources: [] })
const lessons = [lesson('a.mp4', 'Les bends'), lesson('b.mp4', 'Le vibrato')]
const course: Course = { id: 'm', name: 'Méthode rock', outline: lessons, lessons }

const sources: SearchSources = {
  courses: [course],
  annotations: {
    'b.mp4': { notes: 'Garder le poignet souple\nPentatonique en Lá', bookmarks: [{ id: 'x', time: 42, label: 'Solo pentatonique' }] },
  },
  progressions: [{ id: 'p', name: 'Blues en La', chords: ['A7', 'D7', 'E7'], notes: '' }],
  routines: [{ id: 'r', name: 'Échauffement', steps: [{ name: 'Pentatonique', minutes: 5, details: '' }], notes: '' }],
  tones: [],
  scores: null,
}

const kinds = (query: string) => search(sources, query).map((hit) => hit.target.kind)

describe('search', () => {
  it('ne trouve rien sans mot cherché', () => {
    expect(search(sources, '   ')).toEqual([])
  })

  it('cherche sans tenir compte des accents ni des majuscules, dans chaque source', () => {
    expect(kinds('PENTATONIQUE')).toEqual(['note', 'mark', 'routine'])
    expect(kinds('methode')).toEqual(['lesson', 'lesson'])
    expect(kinds('d7')).toEqual(['chords'])
  })

  it('exige chaque mot', () => {
    expect(kinds('vibrato rock')).toEqual(['lesson'])
    expect(kinds('vibrato jazz')).toEqual([])
  })

  it('montre la ligne de la note où apparaît le mot', () => {
    expect(search(sources, 'la penta')[0]).toMatchObject({ title: 'Pentatonique en Lá', detail: 'Le vibrato' })
    expect(excerpt('x'.repeat(200), ['y'])).toHaveLength(90)
  })
})
