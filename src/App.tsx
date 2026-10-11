import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnnotationsMap, CourseFile, CourseFolder, ProgressMap } from './courseTypes.ts'
import {
  countLessons,
  groupPathsTo,
  listCourses,
  pickStartLesson,
  type Course,
  type Lesson,
} from './lessons.ts'
import { putFavorite, putProgress, type ProgressUpdate } from './media.ts'
import { Notes } from './Notes.tsx'
import { Outline } from './Outline.tsx'
import { Player } from './Player.tsx'
import { Practice } from './Practice.tsx'
import { formatTime, resumePosition } from './progress.ts'
import { Resources } from './Resources.tsx'
import { ShortcutsHelp } from './ShortcutsHelp.tsx'
import { NO_ANNOTATIONS, useAnnotations } from './useAnnotations.ts'

// Constantes (et non `[]` à chaque rendu) pour que les hooks qui en dépendent restent stables.
const NO_ITEMS: Course['outline'] = []
const NO_LESSONS: Lesson[] = []

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
  const [helpOpen, setHelpOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { annotations, setAll: setAllAnnotations, update: updateAnnotations, flush: flushAnnotations } =
    useAnnotations(setSaveError)

  const courses = useMemo(() => (root ? listCourses(root) : []), [root])
  const course: Course | null = courses.find((c) => c.id === courseId) ?? courses[0] ?? null
  const outline = course?.outline ?? NO_ITEMS
  const lessons = course?.lessons ?? NO_LESSONS

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

  const toggleGroup = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }, [])

  const index = lessons.findIndex((l) => l.id === currentId)
  const lesson = index >= 0 ? lessons[index] : null
  const previous = index > 0 ? lessons[index - 1] : null
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null
  const favoriteLessons = useMemo(() => lessons.filter((l) => favorites.has(l.id)), [lessons, favorites])
  const entry = lesson && progress ? progress[lesson.id] : undefined
  const lessonAnnotations = (lesson && annotations[lesson.id]) || NO_ANNOTATIONS
  const totals = progress ? countLessons(outline, progress) : null
  const resume = resumePosition(entry)

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

  const outlineProps = {
    currentId,
    progress: progress ?? {},
    expanded,
    onToggleGroup: toggleGroup,
    onSelect: select,
    onToggleDone: toggleDone,
    favorites,
    onToggleFavorite: toggleFavorite,
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="brand">
            <h1>GuitareCourse</h1>
            <button
              type="button"
              className="help-button"
              onClick={() => setHelpOpen(true)}
              title="Raccourcis clavier (?)"
            >
              ⌨ Raccourcis
            </button>
          </div>
          {courses.length > 1 && progress ? (
            <label className="course-picker">
              <span>Méthode</span>
              <select value={course?.id ?? ''} onChange={(event) => selectCourse(event.target.value)}>
                {courses.map((c) => {
                  const { done, total } = countLessons(c.outline, progress)
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({done}/{total})
                    </option>
                  )
                })}
              </select>
            </label>
          ) : (
            course && <p className="course-name">{course.name}</p>
          )}
          {totals && totals.total > 0 && (
            <div className="overall">
              <div
                className="bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totals.total}
                aria-valuenow={totals.done}
                aria-label="Progression de la méthode"
              >
                <span style={{ width: `${(totals.done / totals.total) * 100}%` }} />
              </div>
              <p>
                {totals.done} / {totals.total} {totals.total > 1 ? 'leçons terminées' : 'leçon terminée'}
              </p>
            </div>
          )}
        </header>
        <nav aria-label="Plan de la méthode">
          {progress && favoriteLessons.length > 0 && (
            <details className="favorites" open>
              <summary>
                <span>★ Favoris</span>
                <span className="group-count">{favoriteLessons.length}</span>
              </summary>
              <Outline items={favoriteLessons} {...outlineProps} />
            </details>
          )}
          {progress && <Outline items={outline} {...outlineProps} />}
        </nav>
      </aside>

      <main className="content">
        {error && <p className="notice" role="alert">{error}</p>}
        {saveError && (
          <p className="notice" role="alert">
            Le changement n'a pas pu être enregistré.
          </p>
        )}
        {!root && !error && <p>Chargement…</p>}
        {root && courses.length === 0 && (
          <p className="notice">
            Aucune méthode trouvée : déposez un dossier contenant des vidéos .mp4 dans « {root.name} ».
          </p>
        )}

        {lesson && progress && (
          <article>
            <Player
              key={lesson.id}
              file={lesson.video}
              progress={entry}
              videoRef={videoRef}
              rate={rate}
              onSave={save}
            />
            <Practice
              key={`practice-${lesson.id}`}
              videoRef={videoRef}
              rate={rate}
              onRateChange={setRate}
              bookmarks={lessonAnnotations.bookmarks}
              onBookmarksChange={(bookmarks) => updateAnnotations(lesson.id, { bookmarks })}
              onNext={next ? () => select(next) : null}
              onPrevious={previous ? () => select(previous) : null}
              onHelp={() => setHelpOpen(true)}
            />
            <header className="lesson-header">
              <p className="lesson-crumb">{lesson.context}</p>
              <h2>{lesson.title}</h2>
              <p className="lesson-status">
                {entry?.completed
                  ? 'Leçon terminée'
                  : resume > 0
                    ? `Reprise à ${formatTime(resume)}`
                    : 'Pas encore commencée'}
              </p>
            </header>
            <div className="actions">
              <button type="button" className="primary" onClick={() => toggleDone(lesson)}>
                {entry?.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
              </button>
              <button type="button" aria-pressed={favorites.has(lesson.id)} onClick={() => toggleFavorite(lesson)}>
                {favorites.has(lesson.id) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}
              </button>
              <span className="spacer" />
              <button type="button" disabled={!previous} onClick={() => previous && select(previous)}>
                ← Précédente
              </button>
              <button type="button" disabled={!next} onClick={() => next && select(next)}>
                Suivante →
              </button>
            </div>
            <Notes
              key={`notes-${lesson.id}`}
              value={lessonAnnotations.notes}
              onChange={(notes) => updateAnnotations(lesson.id, { notes })}
              onBlur={() => flushAnnotations(lesson.id)}
            />
            <Resources files={lesson.resources} />
          </article>
        )}
      </main>
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
