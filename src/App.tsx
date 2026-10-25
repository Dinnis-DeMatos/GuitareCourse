import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnnotationsMap, CourseFile, CourseFolder, ProgressMap } from './courseTypes.ts'
import { chooseCoursesDir, setDesktopTheme } from './desktop.ts'
import { finishAt, finishByLesson } from './finishes.ts'
import { groupPathsTo, lessonCrumbs, listCourses, pickStartLesson, type Course, type Lesson } from './lessons.ts'
import { putFavorite, putProgress, type ProgressUpdate } from './media.ts'
import { Icon } from './ui/Icon.tsx'
import { LessonView } from './ui/LessonView.tsx'
import type { OutlineActions } from './ui/Outline.tsx'
import type { Sound } from './ui/Pedal.tsx'
import { FretboardTrainer } from './ui/FretboardTrainer.tsx'
import { MetronomeDialog } from './ui/Metronome.tsx'
import { ShortcutsHelp } from './ui/ShortcutsHelp.tsx'
import { Sidebar } from './ui/Sidebar.tsx'
import { NO_ANNOTATIONS, useAnnotations } from './useAnnotations.ts'
import { usePersistentState } from './usePersistentState.ts'

// Constantes (et non `[]` ou `{}` à chaque rendu) pour que les hooks qui en dépendent restent stables.
const NO_ITEMS: Course['outline'] = []
const NO_LESSONS: Lesson[] = []
const NO_PROGRESS: ProgressMap = {}

const FULL_SOUND: Sound = { volume: 1, muted: false }

export type Theme = 'dark' | 'light'

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

function isSound(value: unknown): value is Sound {
  if (typeof value !== 'object' || value === null) return false
  const { volume, muted } = value as Record<string, unknown>
  return typeof volume === 'number' && volume >= 0 && volume <= 1 && typeof muted === 'boolean'
}

async function load<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? `Erreur ${response.status}`)
  return body as T
}

export default function App() {
  const [root, setRoot] = useState<CourseFolder | null>(null)
  const [progress, setProgress] = useState<ProgressMap | null>(null)
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  // Vitesse de lecture : choisie une fois, elle vaut pour toutes les leçons.
  const [rate, setRate] = useState(1)
  // Le volume, lui, est retrouvé d'une visite à l'autre.
  const [sound, setSound] = usePersistentState('guitarecourse.sound', FULL_SOUND, isSound)
  // Le thème est appliqué à la racine du document ; index.html le pose déjà avant le premier affichage.
  const [theme, setTheme] = usePersistentState<Theme>('guitarecourse.theme', 'dark', isTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    setDesktopTheme(theme)
  }, [theme])
  const [helpOpen, setHelpOpen] = useState(false)
  const [trainerOpen, setTrainerOpen] = useState(false)
  const [metronomeOpen, setMetronomeOpen] = useState(false)
  // Sur écran étroit, le plan est un tiroir qu'on ouvre à la demande.
  const [navOpen, setNavOpen] = useState(false)
  const { annotations, setAll: setAllAnnotations, update: updateAnnotations, flush: flushAnnotations } =
    useAnnotations(setSaveError)

  const courses = useMemo(() => (root ? listCourses(root) : []), [root])
  const course: Course | null = courses.find((c) => c.id === courseId) ?? courses[0] ?? null
  const outline = course?.outline ?? NO_ITEMS
  const lessons = course?.lessons ?? NO_LESSONS
  const finishes = useMemo(() => finishByLesson(outline), [outline])

  useEffect(() => {
    Promise.all([
      load<CourseFolder>('/api/course'),
      load<ProgressMap>('/api/progress'),
      load<string[]>('/api/favorites'),
      load<AnnotationsMap>('/api/annotations'),
    ])
      .then(([tree, saved, savedFavorites, savedAnnotations]) => {
        setAllAnnotations(savedAnnotations)
        const all = listCourses(tree)
        // On ouvre la méthode et la leçon à reprendre, toutes méthodes confondues.
        const start = pickStartLesson(
          all.flatMap((c) => c.lessons),
          saved,
        )
        setRoot(tree)
        setProgress(saved)
        setFavorites(new Set(savedFavorites))
        if (start) {
          const owner = all.find((c) => c.lessons.some((l) => l.id === start.id))
          setCourseId(owner?.id ?? null)
          setCurrentId(start.id)
          setExpanded(new Set(owner ? (groupPathsTo(owner.outline, start.id) ?? []) : []))
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [setAllAnnotations])

  const save = useCallback((file: CourseFile, update: ProgressUpdate) => {
    setProgress((previous) => ({
      ...previous,
      [file.path]: { ...update, updatedAt: new Date().toISOString() },
    }))
    putProgress(file.path, update).then(
      () => setSaveError(false),
      () => setSaveError(true),
    )
  }, [])

  const toggleFavorite = useCallback(
    (target: Lesson) => {
      const favorite = !favorites.has(target.id)
      setFavorites((previous) => {
        const next = new Set(previous)
        if (favorite) next.add(target.id)
        else next.delete(target.id)
        return next
      })
      putFavorite(target.id, favorite).then(
        () => setSaveError(false),
        () => setSaveError(true),
      )
    },
    [favorites],
  )

  const select = useCallback(
    (lesson: Lesson) => {
      setCurrentId(lesson.id)
      setExpanded((previous) => new Set([...previous, ...(groupPathsTo(outline, lesson.id) ?? [])]))
      setNavOpen(false)
      window.scrollTo({ top: 0 })
    },
    [outline],
  )

  /** Change de méthode : ouvre la leçon à reprendre dans celle-ci. */
  const selectCourse = useCallback(
    (id: string) => {
      const target = courses.find((c) => c.id === id)
      if (!target || !progress) return
      const start = pickStartLesson(target.lessons, progress)
      setCourseId(id)
      setCurrentId(start?.id ?? null)
      setExpanded(new Set(start ? (groupPathsTo(target.outline, start.id) ?? []) : []))
    },
    [courses, progress],
  )

  // Là où l'on en est, toutes méthodes confondues : la leçon proposée à l'ouverture.
  const resumeLesson = useMemo(
    () => (progress ? (pickStartLesson(courses.flatMap((c) => c.lessons), progress) ?? null) : null),
    [courses, progress],
  )

  /** Retourne à la leçon en cours ; la vidéo se replace d'elle-même là où on l'avait laissée, sans démarrer. */
  const resume = useCallback(() => {
    const owner = courses.find((c) => c.lessons.some((l) => l.id === resumeLesson?.id))
    if (!owner || !resumeLesson) return
    setCourseId(owner.id)
    setCurrentId(resumeLesson.id)
    setExpanded((previous) => new Set([...previous, ...(groupPathsTo(owner.outline, resumeLesson.id) ?? [])]))
    setNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [courses, resumeLesson])

  const toggleGroup = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }, [])

  /** Coche ou décoche une leçon : décocher la remet à zéro (elle repart du début). */
  const toggleDone = useCallback(
    (target: Lesson) => {
      const existing = progress?.[target.id]
      const duration = existing?.duration ?? 0
      if (existing?.completed) save(target.video, { position: 0, duration, completed: false })
      else save(target.video, { position: existing?.position ?? 0, duration, completed: true })
    },
    [progress, save],
  )

  const index = lessons.findIndex((l) => l.id === currentId)
  const lesson = index >= 0 ? lessons[index] : null
  const previous = index > 0 ? lessons[index - 1] : null
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null
  const favoriteLessons = useMemo(() => lessons.filter((l) => favorites.has(l.id)), [lessons, favorites])
  const crumbs = useMemo(() => (lesson ? lessonCrumbs(outline, lesson) : []), [outline, lesson])
  // La finition du chapitre affiché teinte toute l'application, pas seulement la leçon.
  const finish = (lesson && finishes.get(lesson.id)) ?? finishAt(0)

  const actions: OutlineActions = {
    currentId,
    progress: progress ?? NO_PROGRESS,
    expanded,
    favorites,
    onToggleGroup: toggleGroup,
    onSelect: select,
    onToggleDone: toggleDone,
    onToggleFavorite: toggleFavorite,
  }

  return (
    <div className="app" data-finish={finish.id} data-nav={navOpen ? 'open' : undefined}>
      <Sidebar
        courses={courses}
        course={course}
        progress={progress}
        favoriteLessons={favoriteLessons}
        finishes={finishes}
        actions={actions}
        onSelectCourse={selectCourse}
        resume={resumeLesson && resumeLesson.id !== currentId ? resumeLesson : null}
        onResume={resume}
        onHelp={() => setHelpOpen(true)}
        onTrainer={() => {
          setTrainerOpen(true)
          setNavOpen(false)
        }}
        onMetronome={() => {
          setMetronomeOpen(true)
          setNavOpen(false)
        }}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onClose={() => setNavOpen(false)}
      />
      <button type="button" className="scrim" tabIndex={-1} aria-label="Fermer le plan" onClick={() => setNavOpen(false)} />

      <main className="main">
        <div className="topbar">
          <button type="button" className="btn" onClick={() => setNavOpen(true)}>
            <Icon name="menu" />
            Plan
          </button>
        </div>

        {error && (
          <p className="notice" role="alert">
            <b>Le cours n'a pas pu être chargé.</b> {error}
            {chooseCoursesDir && (
              <>
                {' '}
                <button type="button" className="btn" onClick={chooseCoursesDir}>
                  <Icon name="folder" />
                  Choisir le dossier du cours
                </button>
              </>
            )}
          </p>
        )}
        {saveError && (
          <p className="notice" role="alert">
            <b>Enregistrement impossible.</b> Le dernier changement n'a pas été gardé : vérifiez que
            l'application est toujours lancée.
          </p>
        )}
        {!root && !error && (
          <div className="loading" role="status">
            <span className="tuning" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <p>Accordage…</p>
          </div>
        )}
        {root && courses.length === 0 && (
          <p className="notice">
            <b>Aucune méthode trouvée.</b> Déposez un dossier contenant des vidéos .mp4 dans « {root.name} », puis
            rechargez la page.
            {chooseCoursesDir && (
              <>
                {' '}
                <button type="button" className="btn" onClick={chooseCoursesDir}>
                  <Icon name="folder" />
                  Choisir un autre dossier
                </button>
              </>
            )}
          </p>
        )}

        {lesson && progress && (
          <LessonView
            key={lesson.id}
            lesson={lesson}
            finish={finish}
            crumbs={crumbs}
            place={{ rank: index + 1, total: lessons.length }}
            progress={progress[lesson.id]}
            annotations={annotations[lesson.id] ?? NO_ANNOTATIONS}
            favorite={favorites.has(lesson.id)}
            rate={rate}
            sound={sound}
            onRateChange={setRate}
            onSoundChange={setSound}
            onSaveProgress={save}
            onToggleDone={() => toggleDone(lesson)}
            onToggleFavorite={() => toggleFavorite(lesson)}
            onAnnotationsChange={(patch) => updateAnnotations(lesson.id, patch)}
            onAnnotationsBlur={() => flushAnnotations(lesson.id)}
            onPrevious={previous ? () => select(previous) : null}
            onNext={next ? () => select(next) : null}
            onHelp={() => setHelpOpen(true)}
          />
        )}
      </main>

      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <FretboardTrainer open={trainerOpen} onClose={() => setTrainerOpen(false)} />
      <MetronomeDialog open={metronomeOpen} onClose={() => setMetronomeOpen(false)} />
    </div>
  )
}
