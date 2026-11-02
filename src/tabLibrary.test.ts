import { describe, expect, it } from 'vitest'
import type { CourseFile, CourseFolder } from './courseTypes.ts'
import { filterScores, listScores, tabUrl } from './tabLibrary.ts'

const file = (title: string, ext: string, dir = ''): CourseFile => ({
  title,
  ext,
  kind: ext === 'mp4' ? 'video' : 'tab',
  path: `${dir}${title}.${ext}`,
  size: 1,
})

const tree: CourseFolder = {
  name: 'Tablatures',
  path: '',
  files: [file('Blues', 'gp'), file('Blues', 'gpx'), file('Ballade', 'gpx'), file('Ballade', 'pdf')],
  folders: [{ name: 'Été', path: 'Été', files: [file('Romance', 'gp', 'Été/'), file('Vidéo', 'mp4', 'Été/')], folders: [] }],
}

describe('listScores', () => {
  it('garde le .gp et le .gpx du même nom, laisse le PDF, et descend dans les sous-dossiers', () => {
    expect(listScores(tree).map((s) => [s.file.path, s.crumbs])).toEqual([
      ['Blues.gp', []],
      ['Blues.gpx', []],
      ['Ballade.gpx', []],
      ['Été/Romance.gp', ['Été']],
    ])
  })
})

describe('filterScores', () => {
  it('cherche chaque mot dans le titre et les dossiers, sans accents ni majuscules', () => {
    const scores = listScores(tree)
    expect(filterScores(scores, 'ete rom').map((s) => s.file.title)).toEqual(['Romance'])
    expect(filterScores(scores, '  ').length).toBe(4)
  })
})

describe('tabUrl', () => {
  it('encode chaque partie du chemin', () => {
    expect(tabUrl(file('Ma ballade #2', 'gp', 'Été/'))).toBe('/tabs/%C3%89t%C3%A9/Ma%20ballade%20%232.gp')
  })
})
