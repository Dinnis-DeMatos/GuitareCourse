import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CourseFile, CourseFolder, ProgressMap } from './courseTypes.ts'
import { buildOutline, countLessons, groupPathsTo, lessonsOf, pickStartLesson, type Lesson } from './lessons.ts'
import { putFavorite, putProgress, type ProgressUpdate } from './media.ts'
import { Outline } from './Outline.tsx'
import { Player } from './Player.tsx'
import { formatTime, resumePosition } from './progress.ts'
import { Resources } from './Resources.tsx'

async function load<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? `Erreur ${response.status}`)
  return body as T
}

export default function App() {
  const [course, setCourse] = useState<CourseFolder | null>(null)
  const [progress, setProgress] = useState<ProgressMap | null>(null)
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const outline = useMemo(() => (course ? buildOutline(course) : []), [course])
  const lessons = useMemo(() => lessonsOf(outline), [outline])

  useEffect(() => {
    Promise.all([
      load<CourseFolder>('/api/course'),
      load<ProgressMap>('/api/progress'),
      load<string[]>('/api/favorites'),
    ])
      .then(([courseTree, saved, savedFavorites]) => {
        const items = buildOutline(courseTree)
        const start = pickStartLesson(lessonsOf(items), saved)
        setCourse(courseTree)
        setProgress(saved)
        setFavorites(new Set(savedFavorites))
        if (start) {
          setCurrentId(start.id)
          setExpanded(new Set(groupPathsTo(items, start.id) ?? []))
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

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

  const toggleGroup = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }, [])

  const index = lessons.findIndex((lesson) => lesson.id === currentId)
  const lesson = index >= 0 ? lessons[index] : null
  const previous = index > 0 ? lessons[index - 1] : null
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null
  const favoriteLessons = useMemo(() => lessons.filter((item) => favorites.has(item.id)), [lessons, favorites])
  const entry = lesson && progress ? progress[lesson.id] : undefined
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

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>GuitareCourse</h1>
          {course && <p className="course-name">{course.name}</p>}
          {totals && totals.total > 0 && (
            <div className="overall">
              <div
                className="bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totals.total}
                aria-valuenow={totals.done}
                aria-label="Progression du cours"
              >
                <span style={{ width: `${(totals.done / totals.total) * 100}%` }} />
              </div>
              <p>
                {totals.done} / {totals.total} leçons terminées
              </p>
            </div>
          )}
        </header>
        <nav aria-label="Plan du cours">
          {progress && favoriteLessons.length > 0 && (
            <details className="favorites" open>
              <summary>
                <span>★ Favoris</span>
                <span className="group-count">{favoriteLessons.length}</span>
              </summary>
              <Outline
                items={favoriteLessons}
                currentId={currentId}
                progress={progress}
                expanded={expanded}
                onToggleGroup={toggleGroup}
                onSelect={select}
                onToggleDone={toggleDone}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            </details>
          )}
          {progress && (
            <Outline
              items={outline}
              currentId={currentId}
              progress={progress}
              expanded={expanded}
              onToggleGroup={toggleGroup}
              onSelect={select}
              onToggleDone={toggleDone}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          )}
        </nav>
      </aside>

      <main className="content">
        {error && <p className="notice" role="alert">{error}</p>}
        {saveError && (
          <p className="notice" role="alert">
            La progression n'a pas pu être enregistrée.
          </p>
        )}
        {!course && !error && <p>Chargement du cours…</p>}

        {lesson && progress && (
          <article>
            <Player key={lesson.id} file={lesson.video} progress={entry} onSave={save} />
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
            <Resources files={lesson.resources} />
          </article>
        )}
      </main>
    </div>
  )
}
