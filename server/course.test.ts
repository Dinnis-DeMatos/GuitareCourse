import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CourseFolder } from '../src/courseTypes.ts'
import { buildOutline, lessonsOf } from '../src/lessons.ts'
import { scanCourse } from './course.ts'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'guitarecourse-'))
})
afterEach(() => rm(root, { recursive: true, force: true }))

async function touch(...parts: string[]) {
  const file = path.join(root, ...parts)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, 'x')
}

const lessonTitles = (course: CourseFolder) => lessonsOf(buildOutline(course)).map((l) => l.title)

describe('scanCourse', () => {
  it('prend en compte un chapitre ajouté après coup, sans redémarrage', async () => {
    await touch('1 CHAP 1 Base', 'Ep 1 A', 'Part 1', 'premiere.mp4')
    expect(lessonTitles(await scanCourse(root))).toEqual(['premiere'])

    await touch('2 CHAP 2 Suite', 'Ep 1 B', 'Part 1', 'seconde.mp4')
    await touch('2 CHAP 2 Suite', 'Ep 1 B', 'Part 1', 'TABS ET BACKING TRACKS', 'riff.pdf')
    await touch('2 CHAP 2 Suite', 'Ep 1 B', 'Part 1', 'TABS ET BACKING TRACKS', 'bt 90 bpm.wav')

    const course = await scanCourse(root)
    expect(lessonTitles(course)).toEqual(['premiere', 'seconde'])
    const second = lessonsOf(buildOutline(course)).find((l) => l.title === 'seconde')!
    expect(second.resources.map((r) => r.ext).sort()).toEqual(['pdf', 'wav'])
  })

  it('ignore le dossier zip et les formats non gérés', async () => {
    await touch('ch', 'cours.mp4')
    await touch('ch', 'autre.mkv')
    await touch('ch', 'son.mp3')
    await touch('zip', 'archive', 'cache.mp4')
    await touch('ch', '.DS_Store')
    expect(lessonTitles(await scanCourse(root))).toEqual(['cours'])
    const ch = (await scanCourse(root)).folders[0]
    expect(ch.files.map((f) => f.ext)).toEqual(['mp4'])
  })

  it('trie les chapitres dans l\'ordre naturel (2 avant 10)', async () => {
    await touch('10 CHAP 10', 'z.mp4')
    await touch('2 CHAP 2', 'y.mp4')
    expect((await scanCourse(root)).folders.map((f) => f.name)).toEqual(['2 CHAP 2', '10 CHAP 10'])
  })
})
