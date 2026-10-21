import { useEffect, useRef, type CSSProperties } from 'react'
import type { ProgressMap } from '../courseTypes.ts'
import type { Finish } from '../finishes.ts'
import { chooseCoursesDir } from '../desktop.ts'
import { countLessons, type Course, type Lesson } from '../lessons.ts'
import { formatTime, resumePosition } from '../progress.ts'
import type { Theme } from '../App.tsx'
import { Icon } from './Icon.tsx'
import { LessonRow, Outline, type OutlineActions } from './Outline.tsx'

/** Colonne de gauche, l'index : la marque, la méthode et sa progression en grand chiffre, puis le plan. */
export function Sidebar({
  courses,
  course,
  progress,
  favoriteLessons,
  finishes,
  actions,
  onSelectCourse,
  resume,
  onResume,
  onHelp,
  onTrainer,
  theme,
  onToggleTheme,
  onClose,
}: {
  courses: Course[]
  course: Course | null
  progress: ProgressMap | null
  favoriteLessons: Lesson[]
  finishes: ReadonlyMap<string, Finish>
  actions: OutlineActions
  onSelectCourse: (id: string) => void
  /** Leçon où l'on en est, quand on en regarde une autre. */
  resume: Lesson | null
  onResume: () => void
  onHelp: () => void
  /** Ouvre l'exercice de connaissance du manche. */
  onTrainer: () => void
  theme: Theme
  onToggleTheme: () => void
  /** Referme la colonne quand elle est affichée en tiroir (écran étroit). */
  onClose: () => void
}) {
  const nav = useRef<HTMLElement>(null)
  const themeLabel = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'
  const totals = course && progress ? countLessons(course.outline, progress) : null
  const resumeAt = resume && progress ? resumePosition(progress[resume.id]) : 0
  const resumeLabel = resume && `Reprendre « ${resume.title} »${resumeAt > 0 ? ` à ${formatTime(resumeAt)}` : ''}`

  // La leçon en cours reste visible dans le plan quand on en change avec « Suivante » ou au clavier.
  // Elle peut y figurer deux fois (favoris, puis plan) : c'est sa place dans le plan qui compte.
  useEffect(() => {
    const rows = nav.current?.querySelectorAll('.outline [data-current="true"]')
    rows?.[rows.length - 1]?.scrollIntoView({ block: 'nearest' })
  }, [actions.currentId])

  return (
    <aside className="sidebar">
      <div className="brand">
        <h1 className="plate">
          <Icon name="pick" />
          <span className="plate-word">
            Guitare<span>Course</span>
          </span>
        </h1>
        {resume && resumeLabel && (
          <button
            type="button"
            className="round resume"
            data-finish={finishes.get(resume.id)?.id}
            onClick={onResume}
            title={resumeLabel}
            aria-label={resumeLabel}
          >
            <Icon name="play" />
          </button>
        )}
        {chooseCoursesDir && (
          <button
            type="button"
            className="round"
            onClick={chooseCoursesDir}
            title="Changer le dossier du cours"
            aria-label="Changer le dossier du cours"
          >
            <Icon name="folder" />
          </button>
        )}
        <button
          type="button"
          className="round"
          onClick={onTrainer}
          title="Exercice : connaissance du manche"
          aria-label="Exercice : connaissance du manche"
        >
          <Icon name="neck" />
        </button>
        <button
          type="button"
          className="round"
          onClick={onToggleTheme}
          title={themeLabel}
          aria-label={themeLabel}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button
          type="button"
          className="round"
          onClick={onHelp}
          title="Raccourcis clavier (?)"
          aria-label="Raccourcis clavier"
        >
          ?
        </button>
        <button type="button" className="round sidebar-close" onClick={onClose} aria-label="Fermer le plan">
          <Icon name="close" />
        </button>
      </div>

      {course && (
        <div className="method">
          <span id="method-label" className="method-label">
            Méthode
          </span>
          {courses.length > 1 && progress ? (
            <span className="method-picker">
              <select
                aria-labelledby="method-label"
                value={course.id}
                onChange={(event) => onSelectCourse(event.target.value)}
              >
                {courses.map((item) => {
                  const { done, total } = countLessons(item.outline, progress)
                  return (
                    <option key={item.id} value={item.id}>
                      {item.name} — {done}/{total}
                    </option>
                  )
                })}
              </select>
              <Icon name="chevronDown" />
            </span>
          ) : (
            <p className="method-name">{course.name}</p>
          )}
        </div>
      )}

      {totals && totals.total > 0 && (
        <div
          className="meter"
          role="img"
          aria-label={`${totals.done} leçon${totals.done > 1 ? 's' : ''} terminée${totals.done > 1 ? 's' : ''} sur ${totals.total}`}
        >
          <div className="timesig" aria-hidden="true">
            <span>{totals.done}</span>
            <span>{totals.total}</span>
          </div>
          <div className="meter-staff" style={{ '--p': totals.done / totals.total } as CSSProperties} />
          <p className="meter-legend">{totals.total > 1 ? 'leçons terminées' : 'leçon terminée'}</p>
        </div>
      )}

      <nav ref={nav} aria-label="Plan de la méthode">
        {progress && favoriteLessons.length > 0 && (
          <details className="shelf" open>
            <summary className="shelf-head">
              <Icon name="starFilled" />
              Favoris
              <b>{favoriteLessons.length}</b>
            </summary>
            <ul className="items">
              {favoriteLessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  depth={0}
                  finish={finishes.get(lesson.id)}
                  actions={actions}
                />
              ))}
            </ul>
          </details>
        )}
        {progress && course && <Outline items={course.outline} actions={actions} />}
      </nav>
    </aside>
  )
}
