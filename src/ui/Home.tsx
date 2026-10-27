import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
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
 * L'accueil sans cours : il n'y a rien à ouvrir, alors on aide à en ajouter. Un dessin (un dossier ouvert,
 * encore vide, et le médiator au-dessus), ce qu'il faut ranger où, et le choix du dossier.
 */
function NoCourses({ missing, onRefresh }: { missing: Missing; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false)
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
        <div className="home-empty-actions">
          {chooseCoursesDir && (
            <button type="button" className="btn btn-solid home-empty-choose" onClick={chooseCoursesDir}>
              <Icon name="folder" />
              Choisir le dossier des cours
            </button>
          )}
          {/* Vidéos tout juste rangées dans le bon dossier : les relire sans le choisir de nouveau. */}
          <button
            type="button"
            className="btn home-empty-choose"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true)
              void onRefresh().finally(() => setRefreshing(false))
            }}
          >
            {refreshing ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" />}
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
        {!chooseCoursesDir && (
          <p className="home-empty-lead">Dans le navigateur, le dossier se règle par la variable COURSES_DIR.</p>
        )}
      </div>
      <svg className="home-empty-art" viewBox="0 0 240 200" aria-hidden="true">
        <path className="art-folder" d="M30 70v105h170V88h-80l-14-18Z" />
        <path className="art-folder art-folder-front" d="M30 175l24-62h176l-30 62Z" />
        <path
          className="art-pick"
          d="M140 50c-4 0-20-21-20-32 0-8 9-13 20-13s20 5 20 13c0 11-16 32-20 32Z"
          transform="rotate(-18 140 28)"
        />
      </svg>
    </section>
  )
}

export function Home({
  courses,
  missing,
  notice,
  entering,
  onRefreshCourses,
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
  /** Un avertissement à afficher sous la marque (fichier de données récupéré…). */
  notice?: ReactNode
  /** Juste après l'ouverture : l'accueil se dévoile de haut en bas. */
  entering?: boolean
  /** Relit le dossier des cours. */
  onRefreshCourses: () => Promise<void>
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
  // La dernière suite modifiée ; sans date (suites d'avant), la dernière créée.
  const lastChords = chords?.length
    ? chords.reduce((last, p) => ((p.updatedAt ?? '') >= (last.updatedAt ?? '') ? p : last))
    : undefined

  return (
    <div className="home" data-entering={entering || undefined}>
      <header className="home-head">
        <h1 className="plate">
          <Icon name="pick" />
          <span className="plate-word">
            Guitare<span>Course</span>
          </span>
        </h1>
        <Options theme={theme} onToggleTheme={onToggleTheme} onHelp={onHelp} onRefreshCourses={onRefreshCourses} />
      </header>
      {notice}

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
      {missing && <NoCourses missing={missing} onRefresh={onRefreshCourses} />}

      <div className="home-grid">
        {progress && courses.length > 0 && (
          <section className="home-block" aria-labelledby="home-progress-title">
            <h2 id="home-progress-title" className="silk">
              Progression
            </h2>
            {/* Seule cette liste défile quand les méthodes sont trop nombreuses pour la fenêtre. */}
            <div className="home-scroll">
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
            </div>
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
                ? `${plural(chords.length, 'suite')} · dernière : ${lastChords?.name}`
                : "Noter les suites d'accords qui vous plaisent"}
            </span>
          </button>
        </section>

        {favoriteLessons.length > 0 && (
          <section className="home-block home-favorites" aria-labelledby="home-favorites-title">
            <h2 id="home-favorites-title" className="silk">
              Favoris
            </h2>
            <ul className="home-scroll">
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
