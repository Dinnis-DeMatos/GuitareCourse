import { describe, expect, it } from 'vitest'
import type { CourseFile, CourseFolder, ProgressMap } from './courseTypes.ts'
import {
  buildOutline,
  cleanName,
  countLessons,
  groupPathsTo,
  groupsTo,
  lessonCrumbs,
  lessonsOf,
  listCourses,
  pickStartLesson,
  resourceSummary,
  splitName,
} from './lessons.ts'

const file = (path: string, kind: CourseFile['kind']): CourseFile => ({
  title: path.split('/').pop()!.replace(/\.\w+$/, ''),
  ext: kind === 'video' ? 'mp4' : kind === 'audio' ? 'wav' : 'pdf',
  kind,
  path,
  size: 1,
})
const folder = (path: string, files: CourseFile[] = [], folders: CourseFolder[] = []): CourseFolder => ({
  name: path.split('/').pop()!,
  path,
  files,
  folders,
})

// Intro (une vidéo) + Chap 1 > Ep 1 > Part A (vidéo + sous-dossier de ressources) et Part B (vidéo seule)
const course = folder(
  '',
  [],
  [
    folder('0  Intro', [file('0  Intro/intro.mp4', 'video')]),
    folder(
      '1 CHAP 1 Base',
      [],
      [
        folder(
          '1 CHAP 1 Base/Ep 1 Manche',
          [],
          [
            folder(
              '1 CHAP 1 Base/Ep 1 Manche/Part A Octaves',
              [file('A/octaves.mp4', 'video')],
              [
                folder('1 CHAP 1 Base/Ep 1 Manche/Part A Octaves/TABS', [
                  file('A/tab.pdf', 'tab'),
                  file('A/bt 90 bpm.wav', 'audio'),
                ]),
              ],
            ),
            folder('1 CHAP 1 Base/Ep 1 Manche/Part B Tierces', [file('B/tierces.mp4', 'video')]),
          ],
        ),
      ],
    ),
  ],
)

describe('cleanName', () => {
  it('rend les noms de dossiers lisibles', () => {
    expect(cleanName('0  Intro NE PAS louper')).toBe('Intro NE PAS louper')
    expect(cleanName('1 CHAP 1 La base des bases')).toBe('Chapitre 1 · La base des bases')
    expect(cleanName("Ep 1 Apprends ton manche et pi c'est tout")).toBe("Épisode 1 · Apprends ton manche et pi c'est tout")
    expect(cleanName('Part A Gagne en précision')).toBe('Partie A · Gagne en précision')
    expect(cleanName('Part 1')).toBe('Partie 1')
  })
  it('ne touche pas aux mots qui commencent par « Part »', () => {
    expect(cleanName('Partition facile')).toBe('Partition facile')
  })
})

describe('splitName', () => {
  it('sépare le repère du titre', () => {
    expect(splitName('Épisode 1 · Manche')).toEqual({ kicker: 'Épisode 1', title: 'Manche' })
    expect(splitName('Intro')).toEqual({ kicker: null, title: 'Intro' })
  })
})

describe('buildOutline', () => {
  const outline = buildOutline(course)

  it('ne garde qu\'une leçon pour un dossier à vidéo unique', () => {
    expect(outline[0]).toMatchObject({ kind: 'lesson', title: 'intro', context: 'Intro' })
    expect(outline[1]).toMatchObject({ kind: 'group', name: 'Chapitre 1 · Base' })
  })

  it('présente un épisode d\'une seule leçon comme une section', () => {
    const [chapter] = buildOutline(
      folder('', [], [
        folder('CHAP 3 Rythme', [file('R/intro.mp4', 'video')], [
          folder('CHAP 3 Rythme/Ep 1 Fantome', [file('F/chut.mp4', 'video')]),
          folder('CHAP 3 Rythme/Ep 2 Style', [], [
            folder('CHAP 3 Rythme/Ep 2 Style/Part 1', [file('S/claques.mp4', 'video')]),
            folder('CHAP 3 Rythme/Ep 2 Style/Part 2', [file('S/frakle.mp4', 'video')]),
          ]),
        ]),
      ]),
    )
    expect(chapter).toMatchObject({
      kind: 'group',
      items: [
        { kind: 'lesson', title: 'intro' },
        { kind: 'group', name: 'Épisode 1 · Fantome', items: [{ kind: 'lesson', title: 'chut' }] },
        { kind: 'group', name: 'Épisode 2 · Style', items: [{ kind: 'lesson' }, { kind: 'lesson' }] },
      ],
    })
  })

  it('rattache les ressources du sous-dossier à la vidéo', () => {
    const octaves = lessonsOf(outline).find((lesson) => lesson.title === 'octaves')!
    expect(octaves.resources.map((r) => r.path)).toEqual(['A/tab.pdf', 'A/bt 90 bpm.wav'])
    expect(octaves.context).toBe('Partie A · Octaves')
  })

  it('liste les leçons dans l\'ordre et retrouve les groupes à ouvrir', () => {
    expect(lessonsOf(outline).map((l) => l.id)).toEqual(['0  Intro/intro.mp4', 'A/octaves.mp4', 'B/tierces.mp4'])
    expect(groupPathsTo(outline, 'B/tierces.mp4')).toEqual(['1 CHAP 1 Base', '1 CHAP 1 Base/Ep 1 Manche'])
    expect(groupPathsTo(outline, '0  Intro/intro.mp4')).toEqual([])
    expect(groupPathsTo(outline, 'inconnu')).toBeNull()
  })
})

describe('lessonCrumbs', () => {
  const outline = buildOutline(course)
  const find = (title: string) => lessonsOf(outline).find((l) => l.title === title)!

  it('donne le repère de chaque niveau, puis celui du dossier de la leçon', () => {
    expect(lessonCrumbs(outline, find('octaves'))).toEqual(['Chapitre 1', 'Épisode 1', 'Partie A'])
    expect(groupsTo(outline, 'B/tierces.mp4')?.map((g) => g.name)).toEqual(['Chapitre 1 · Base', 'Épisode 1 · Manche'])
  })

  it('garde le nom du dossier quand il n\'a pas de repère', () => {
    expect(lessonCrumbs(outline, { ...find('intro'), context: 'Bienvenue' })).toEqual(['Bienvenue'])
  })

  it('n\'ajoute rien quand le dossier répète le titre ou un niveau déjà cité', () => {
    // Dossier « Intro », vidéo « intro » : le dossier n'apprend rien de plus.
    expect(lessonCrumbs(outline, find('intro'))).toEqual([])
    // Vidéo posée directement dans le dossier de son groupe : le repère n'est pas doublé.
    const inGroup = { ...find('octaves'), context: 'Épisode 1 · Manche' }
    expect(lessonCrumbs(outline, inGroup)).toEqual(['Chapitre 1', 'Épisode 1'])
  })
})

describe('listCourses', () => {
  const root = folder(
    'Cours guitare',
    [file('vrac.mp4', 'video')],
    [
      folder('Méthode A', [file('Méthode A/a.mp4', 'video')]),
      folder('Méthode B', [], [folder('Méthode B/Ep 1', [file('Méthode B/Ep 1/b.mp4', 'video')])]),
      folder('Notes', [file('Notes/memo.pdf', 'tab')]),
    ],
  )

  it('fait de chaque sous-dossier contenant une vidéo une méthode', () => {
    const courses = listCourses(root)
    expect(courses.map((c) => c.name)).toEqual(['Méthode A', 'Méthode B'])
    expect(courses.map((c) => c.id)).toEqual(['Méthode A', 'Méthode B'])
    expect(courses[1].lessons.map((l) => l.title)).toEqual(['b'])
  })

  it('garde un identifiant de leçon unique d\'une méthode à l\'autre', () => {
    const ids = listCourses(root).flatMap((c) => c.lessons.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('resourceSummary', () => {
  const lessons = lessonsOf(buildOutline(course))
  it('compte les tablatures et les backing tracks', () => {
    expect(resourceSummary(lessons.find((l) => l.title === 'octaves')!)).toEqual({ tabs: 1, backingTracks: 1 })
  })
  it('renvoie zéro quand rien n\'accompagne la vidéo', () => {
    expect(resourceSummary(lessons.find((l) => l.title === 'intro')!)).toEqual({ tabs: 0, backingTracks: 0 })
  })
  it('compte une tablature une seule fois même en plusieurs formats', () => {
    const lesson = { ...lessons[0], resources: [file('x/Riff.pdf', 'tab'), file('x/Riff.gp', 'tab'), file('x/Riff.gpx', 'tab')] }
    expect(resourceSummary(lesson).tabs).toBe(1)
  })
})

describe('progression des leçons', () => {
  const lessons = lessonsOf(buildOutline(course))
  const entry = (over: object) => ({ position: 0, duration: 100, completed: false, updatedAt: '2026-10-11T10:00:00Z', ...over })

  it('compte les leçons terminées', () => {
    const progress: ProgressMap = { '0  Intro/intro.mp4': entry({ completed: true }) }
    expect(countLessons(buildOutline(course), progress)).toEqual({ done: 1, total: 3 })
  })

  it('propose la leçon entamée la plus récente, sinon la première non terminée', () => {
    expect(pickStartLesson(lessons, {})?.id).toBe('0  Intro/intro.mp4')
    const done: ProgressMap = { '0  Intro/intro.mp4': entry({ completed: true }) }
    expect(pickStartLesson(lessons, done)?.id).toBe('A/octaves.mp4')
    const started: ProgressMap = {
      ...done,
      'A/octaves.mp4': entry({ position: 10, updatedAt: '2026-10-10T10:00:00Z' }),
      'B/tierces.mp4': entry({ position: 20, updatedAt: '2026-10-11T10:00:00Z' }),
    }
    expect(pickStartLesson(lessons, started)?.id).toBe('B/tierces.mp4')
  })
})
