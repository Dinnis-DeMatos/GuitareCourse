import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { ChordProgression, ProgressMap } from '../courseTypes.ts'
import { buildJournal, groupByDay, type JournalKind, type JournalSources } from '../journal.ts'
import type { Course, Lesson } from '../lessons.ts'
import type { Routine, RoutineRun } from '../routines.ts'
import type { Tone } from '../tones.ts'
import { Icon, type IconName } from './Icon.tsx'

const ICONS: Record<JournalKind, IconName> = {
  lesson: 'check',
  trainer: 'neck',
  chords: 'chord',
  tone: 'amp',
  routine: 'routine',
  run: 'metronome',
}

/** Ce qu'on a pratiqué ressort sur la frise ; ce qu'on a seulement noté reste discret. */
const PRACTICE: ReadonlySet<JournalKind> = new Set(['lesson', 'trainer', 'run'])

const time = (date: string) => new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Le jour d'une clé « 2026-11-05 », à minuit, heure locale. */
const dayOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Jours entiers entre deux clés (changement d'heure compris). */
const daysBetween = (from: string, to: string) => Math.round((dayOf(to).getTime() - dayOf(from).getTime()) / 86_400_000)

/**
 * Le parcours : ce qu'on a fait, jour par jour, sur une frise horizontale qui se lit de gauche à droite
 * (leçons terminées, séances du manche, routines menées au bout, suites, sons et routines notés). Une
 * frise, pas un outil : elle s'ouvre du bouton « Parcours » de l'accueil, et tout y vient des données
 * déjà enregistrées.
 */
export function Journal({
  courses,
  progress,
  trainer,
  chords,
  tones,
  routines,
  runs,
  onOpenLesson,
  onClose,
}: {
  courses: Course[]
  progress: ProgressMap | null
  trainer: JournalSources['trainer']
  chords: ChordProgression[] | null
  tones: Tone[] | null
  routines: Routine[] | null
  runs: RoutineRun[] | null
  onOpenLesson: (lesson: Lesson) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])
  const lessons = useMemo(() => new Map(courses.flatMap((c) => c.lessons.map((l) => [l.id, { lesson: l, course: c.name }]))), [courses])
  // De gauche à droite, comme on lit : le plus ancien d'abord, et dans chaque jour, du matin au soir.
  // shortcut: tous les jours sont dessinés d'un coup ; paginer si l'historique devient très long.
  const days = useMemo(
    () =>
      groupByDay(
        buildJournal({
          progress,
          lessons: [...lessons.values()].map(({ lesson, course }) => ({ id: lesson.id, title: lesson.title, course })),
          trainer,
          chords,
          tones,
          routines,
          runs,
        }),
      )
        .toReversed()
        .map((day) => ({ ...day, events: day.events.toReversed() })),
    [lessons, progress, trainer, chords, tones, routines, runs],
  )
  const track = useRef<HTMLOListElement>(null)
  // On ouvre sur aujourd'hui, au bout de la frise.
  useEffect(() => {
    track.current?.scrollTo({ left: track.current.scrollWidth })
  }, [days])
  const thisYear = new Date().getFullYear()

  return (
    <dialog ref={dialog} tabIndex={-1} className="sheet journal" aria-labelledby="journal-title" onClose={onClose}>
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Jour après jour</p>
            <h2 id="journal-title">Parcours</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            <Icon name="close" />
            Fermer
          </button>
        </div>
        {days.length === 0 ? (
          <p className="journal-empty">Vos leçons terminées, séances et routines s'afficheront ici, jour après jour.</p>
        ) : (
          <p className="frise-legend" aria-hidden="true">
            <span data-practice>Pratiqué</span>
            <span>Noté</span>
          </p>
        )}
        <ol
          ref={track}
          className="frise"
          aria-label="Parcours, du plus ancien au plus récent"
          onWheel={(event) => {
            // La molette fait défiler la frise de côté, sauf dans une journée trop remplie qui défile elle-même.
            const column = (event.target as HTMLElement).closest('.frise-events')
            if (column && column.scrollHeight > column.clientHeight) return
            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY
          }}
        >
          {days.map((day, index) => {
            const gap = index > 0 ? daysBetween(days[index - 1].key, day.key) - 1 : 0
            const date = dayOf(day.key)
            const today = day.label === "Aujourd'hui"
            const named = today || day.label === 'Hier'
            const practiced = day.events.some((e) => PRACTICE.has(e.kind))
            return (
              <Fragment key={day.key}>
                {gap > 0 && (
                  <li className="frise-gap" aria-label={`${gap} jour${gap > 1 ? 's' : ''} sans rien de noté`}>
                    <span className="frise-gap-line" />
                    <span className="frise-gap-label">{gap} j</span>
                  </li>
                )}
                <li className="frise-day" aria-label={day.label} data-today={today || undefined}>
                  <ol className="frise-events">
                    {day.events.map((event, i) => {
                      const practice = PRACTICE.has(event.kind) || undefined
                      const body = (
                        <>
                          <span className="frise-icon">
                            <Icon name={ICONS[event.kind]} />
                          </span>
                          <span className="frise-title">{event.title}</span>
                          <span className="frise-detail">{event.detail}</span>
                          <time className="frise-time" dateTime={event.date}>
                            {time(event.date)}
                          </time>
                        </>
                      )
                      const lesson = event.lessonId ? lessons.get(event.lessonId)?.lesson : undefined
                      return (
                        <li key={i}>
                          {lesson ? (
                            <button
                              type="button"
                              className="frise-card"
                              data-practice={practice}
                              title="Revoir cette leçon"
                              onClick={() => {
                                onClose()
                                onOpenLesson(lesson)
                              }}
                            >
                              {body}
                            </button>
                          ) : (
                            <div className="frise-card" data-practice={practice}>
                              {body}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                  <span className="frise-tick" data-practice={practiced || undefined} />
                  <p className="frise-date">
                    <span>{named ? day.label : date.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                    <b>{date.getDate()}</b>
                    <span>
                      {date.toLocaleDateString('fr-FR', { month: 'short', ...(date.getFullYear() !== thisYear ? { year: 'numeric' } : {}) })}
                    </span>
                  </p>
                </li>
              </Fragment>
            )
          })}
        </ol>
      </div>
    </dialog>
  )
}
