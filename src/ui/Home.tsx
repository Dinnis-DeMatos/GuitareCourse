import { useEffect, useState, type CSSProperties } from 'react'
import type { Theme } from '../App.tsx'
import type { ChordProgression, ProgressMap } from '../courseTypes.ts'
import { countLessons, lessonCrumbs, type Course, type Lesson } from '../lessons.ts'
import { formatTime, resumePosition } from '../progress.ts'
import { chooseCoursesDir } from '../desktop.ts'
import { Icon } from './Icon.tsx'
import { useMetronome } from './Metronome.tsx'
import { Options } from './Options.tsx'

/** Ce que l'accueil lit de l'exercice du manche (voir TrainerData dans FretboardTrainer.tsx). */
interface TrainerSummary {
  sessions: { date: string }[]
}

const MAX_FAVORITES = 5

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

/**
 * L'accueil, à l'ouverture : la leçon à reprendre d'abord, puis la progression de chaque méthode, les
 * deux outils avec leur dernier état, et les favoris.
 */
export type Missing = { error: string } | { folder: string }

/**
 * L'accueil sans cours : il n'y a rien à ouvrir, alors on aide à en ajouter. Un dessin (un dossier dont
 * les six cordes attendent le médiator), ce qu'il faut ranger où, et le choix du dossier.
 */
function NoCourses({ missing }: { missing: Missing }) {
  return (
    <section className="home-empty" aria-labelledby="home-empty-title">
      <div className="home-empty-text">
        <p className="silk">{'error' in missing ? 'Dossier introuvable' : 'Premier pas'}</p>
        <h2 id="home-empty-title">Ajoutez vos cours de guitare</h2>
        <p className="home-empty-lead">
          {'error' in missing
            ? "Le dossier des cours n'a pas pu être lu : il a peut-être été déplacé ou renommé."
            : `Le dossier « ${missing.folder} » ne contient encore aucune vidéo.`}{' '}
          Choisissez le dossier où sont rangées vos méthodes : l'application y trouve les leçons toute seule.
        </p>
        <ol className="home-empty-tree" aria-label="Organisation attendue">
          <li>
            <Icon name="folder" />
            <b>Mes cours</b> <span>le dossier à choisir</span>
          </li>
          <li data-depth="1">
            <Icon name="folder" />
            <b>Méthode de guitare</b> <span>une méthode par dossier</span>
          </li>
          <li data-depth="2">
            <Icon name="play" />
            <b>01 Introduction.mp4</b> <span>ses vidéos, dans l'ordre</span>
          </li>
        </ol>
        {chooseCoursesDir ? (
          <button type="button" className="btn btn-solid home-empty-choose" onClick={chooseCoursesDir}>
            <Icon name="folder" />
            Choisir le dossier des cours
          </button>
        ) : (
          <p className="home-empty-lead">Dans le navigateur, le dossier se règle par la variable COURSES_DIR.</p>
        )}
      </div>
      <svg className="home-empty-art" viewBox="0 0 240 200" aria-hidden="true">
        <path className="art-folder" d="M20 52h70l14 16h116v112H20Z" />
        {[0, 1, 2, 3, 4, 5].map((string) => (
          <line key={string} className="art-string" x1="36" x2="204" y1={92 + string * 15} y2={92 + string * 15} />
        ))}
        <path
          className="art-pick"
          d="M152 74c-3 0-15-16-15-24 0-6 7-10 15-10s15 4 15 10c0 8-12 24-15 24Z"
          transform="rotate(-18 152 56)"
        />
      </svg>
    </section>
  )
}

export function Home({
  courses,
  missing,
  progress,
  favorites,
  resume,
  toolOpen,
  onOpenLesson,
  onOpenCourse,
  onMetronome,
  onTrainer,
  onChords,
  theme,
  onToggleTheme,
  onHelp,
}: {
  courses: Course[]
  /**
   * Pourquoi il n'y a rien à suivre : aucun dossier lisible (l'erreur du chargement), ou un dossier sans
   * méthode (son nom). null quand les cours sont là, ou pas encore chargés.
   */
  missing: Missing | null
  progress: ProgressMap | null
  favorites: ReadonlySet<string>
  resume: Lesson | null
  /** Le bilan du manche et le carnet sont relus à la fermeture de leur fenêtre. */
  toolOpen: boolean
  onOpenLesson: (lesson: Lesson) => void
  /** Ouvre une méthode, ou les cours tels qu'on les a laissés (null). */
  onOpenCourse: (id: string | null) => void
  onMetronome: () => void
  onTrainer: () => void
  onChords: () => void
  theme: Theme
  onToggleTheme: () => void
  onHelp: () => void
}) {
  const { bpm, beats, playing } = useMetronome()
  const [trainer, setTrainer] = useState<TrainerSummary | null>(null)
  const [chords, setChords] = useState<ChordProgression[] | null>(null)
  useEffect(() => {
    if (toolOpen) return
    // shortcut: la séance qu'on vient de finir peut arriver après cette lecture ; la relire alors si ça gêne.
    fetch('/api/trainer')
      .then((response) => (response.ok ? (response.json() as Promise<TrainerSummary>) : null))
      .then(setTrainer, () => setTrainer(null))
    fetch('/api/chords')
      .then((response) => (response.ok ? (response.json() as Promise<ChordProgression[]>) : null))
      .then(setChords, () => setChords(null))
  }, [toolOpen])

  const owner = resume && courses.find((c) => c.lessons.some((l) => l.id === resume.id))
  const entry = resume ? progress?.[resume.id] : undefined
  const at = resumePosition(entry)
  const duration = entry?.duration ?? 0
  const favoriteLessons = courses.flatMap((c) => c.lessons).filter((l) => favorites.has(l.id))
  const lastSession = trainer?.sessions.at(-1)

  return (
    <div className="home">
      <header className="home-head">
        <h1 className="plate">
          <Icon name="pick" />
          <span className="plate-word">
            Guitare<span>Course</span>
          </span>
        </h1>
        <Options theme={theme} onToggleTheme={onToggleTheme} onHelp={onHelp} />
      </header>

      {resume && owner && (
        <section className="home-resume" aria-labelledby="home-resume-title">
          <p className="silk">{at > 0 ? 'Reprendre' : 'À suivre'}</p>
          <p className="crumb">{lessonCrumbs(owner.outline, resume).join(' / ')}</p>
          <h2 id="home-resume-title">{resume.title}</h2>
          <button
            type="button"
            className="home-play"
            onClick={() => onOpenLesson(resume)}
            aria-label={at > 0 ? `Reprendre à ${formatTime(at)}` : 'Ouvrir la leçon'}
          >
            <Icon name="play" />
          </button>
          <div className="home-time">
            <div className="meter-staff" style={{ '--p': duration > 0 ? at / duration : 0 } as CSSProperties} />
            <span>{duration > 0 ? `${formatTime(at)} / ${formatTime(duration)}` : 'Pas encore commencée'}</span>
          </div>
          <button type="button" className="home-link" onClick={() => onOpenCourse(null)}>
            {owner.name} · Parcourir les cours
          </button>
        </section>
      )}
      {missing && <NoCourses missing={missing} />}

      <div className="home-grid">
        {progress && courses.length > 0 && (
          <section className="home-block" aria-labelledby="home-progress-title">
            <h2 id="home-progress-title" className="silk">
              Progression
            </h2>
            {courses.map((c) => {
              const { done, total } = countLessons(c.outline, progress)
              return (
                <button key={c.id} type="button" className="home-course" onClick={() => onOpenCourse(c.id)}>
                  <span className="home-course-name">{c.name}</span>
                  <span className="meter" aria-label={`${done} leçons terminées sur ${total}`}>
                    <span className="timesig" aria-hidden="true">
                      <span>{done}</span>
                      <span>{total}</span>
                    </span>
                    <span className="meter-legend">{total > 1 ? 'leçons terminées' : 'leçon terminée'}</span>
                    <span className="meter-staff" style={{ '--p': total > 0 ? done / total : 0 } as CSSProperties} />
                  </span>
                </button>
              )
            })}
          </section>
        )}

        <section className="home-block" aria-labelledby="home-tools-title">
          <h2 id="home-tools-title" className="silk">
            Outils
          </h2>
          <button type="button" className="home-tool" onClick={onMetronome}>
            <Icon name="metronome" />
            <span className="home-tool-title">Métronome</span>
            <span className="home-tool-text">
              {bpm} BPM · {beats} temps
              {playing && ' · en marche'}
            </span>
          </button>
          <button type="button" className="home-tool" onClick={onTrainer}>
            <Icon name="neck" />
            <span className="home-tool-title">Manche</span>
            <span className="home-tool-text">
              {trainer && lastSession
                ? `${plural(trainer.sessions.length, 'séance')} · dernière le ${new Date(lastSession.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                : 'Apprendre les notes du manche'}
            </span>
          </button>
          <button type="button" className="home-tool" onClick={onChords}>
            <Icon name="chord" />
            <span className="home-tool-title">Accords</span>
            <span className="home-tool-text">
              {chords && chords.length > 0
                ? `${plural(chords.length, 'suite')} · dernière : ${chords.at(-1)?.name}`
                : "Noter les suites d'accords qui vous plaisent"}
            </span>
          </button>
        </section>

        {favoriteLessons.length > 0 && (
          <section className="home-block home-favorites" aria-labelledby="home-favorites-title">
            <h2 id="home-favorites-title" className="silk">
              Favoris
            </h2>
            <ul>
              {favoriteLessons.slice(0, MAX_FAVORITES).map((lesson) => (
                <li key={lesson.id}>
                  <button type="button" onClick={() => onOpenLesson(lesson)}>
                    <Icon name="starFilled" />
                    {lesson.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
