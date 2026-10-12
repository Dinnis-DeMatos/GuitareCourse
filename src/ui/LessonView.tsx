import { useEffect, useRef } from 'react'
import type { Bookmark, CourseFile, LessonAnnotations, VideoProgress } from '../courseTypes.ts'
import type { Finish } from '../finishes.ts'
import { resourceSummary, type Lesson } from '../lessons.ts'
import type { ProgressUpdate } from '../media.ts'
import { rateLabel, stepRate } from '../player/rates.ts'
import { toggleFullscreen, useFullscreen } from '../player/useFullscreen.ts'
import { hasRegion, NO_LOOP, useLoop } from '../player/useLoop.ts'
import { useOsd } from '../player/useOsd.ts'
import { useProgressSaver } from '../player/useProgressSaver.ts'
import { useShortcuts } from '../player/useShortcuts.ts'
import { formatTime, resumePosition } from '../progress.ts'
import { SEEK_SECONDS, type ShortcutAction } from '../shortcuts.ts'
import { BackingTracks } from './BackingTracks.tsx'
import { Icon } from './Icon.tsx'
import { Marks } from './Marks.tsx'
import { Notes } from './Notes.tsx'
import { Pedal, type Sound } from './Pedal.tsx'
import { Stage } from './Stage.tsx'
import { Tablatures } from './Tablatures.tsx'

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

/**
 * Une leçon : son titre, la vidéo et ses commandes, puis le pupitre (repères, notes, tablatures,
 * backing tracks). Rassemble aussi les actions du lecteur, que déclenchent indifféremment les
 * boutons et les raccourcis clavier.
 */
export function LessonView({
  lesson,
  finish,
  crumbs,
  place,
  progress,
  annotations,
  favorite,
  rate,
  sound,
  onRateChange,
  onSoundChange,
  onSaveProgress,
  onToggleDone,
  onToggleFavorite,
  onAnnotationsChange,
  onAnnotationsBlur,
  onPrevious,
  onNext,
  onHelp,
}: {
  lesson: Lesson
  finish: Finish
  /** Fil d'Ariane : « Chapitre 1 », « Épisode 2 », « Partie D ». */
  crumbs: string[]
  /** Rang de la leçon dans la méthode (à partir de 1) et nombre de leçons. */
  place: { rank: number; total: number }
  progress: VideoProgress | undefined
  annotations: LessonAnnotations
  favorite: boolean
  rate: number
  sound: Sound
  onRateChange: (rate: number) => void
  onSoundChange: (sound: Sound) => void
  onSaveProgress: (file: CourseFile, update: ProgressUpdate) => void
  onToggleDone: () => void
  onToggleFavorite: () => void
  onAnnotationsChange: (patch: Partial<LessonAnnotations>) => void
  /** Envoie tout de suite les annotations au serveur (quand on quitte le champ des notes). */
  onAnnotationsBlur: () => void
  /** Leçon précédente / suivante ; null s'il n'y en a pas. */
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  onHelp: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const { message, say } = useOsd()
  const { loop, setLoop, current: currentLoop } = useLoop(videoRef)
  const videoHandlers = useProgressSaver(lesson.video, progress, onSaveProgress)
  const fullscreen = useFullscreen(stageRef)

  // Les valeurs les plus récentes, tenues à jour sans attendre le rendu : deux raccourcis frappés
  // coup sur coup (deux repères, deux crans de vitesse) ne doivent pas repartir de l'ancien état.
  const marks = annotations.bookmarks
  const latestMarks = useRef(marks)
  const latestRate = useRef(rate)
  useEffect(() => {
    latestMarks.current = marks
    latestRate.current = rate
  }, [marks, rate])

  // Le titre de la leçon dans l'onglet du navigateur : on s'y retrouve parmi plusieurs onglets.
  useEffect(() => {
    document.title = `${lesson.title} · GuitareCourse`
    return () => {
      document.title = 'GuitareCourse'
    }
  }, [lesson.title])

  const now = () => videoRef.current?.currentTime ?? 0

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => undefined)
    else video.pause()
  }

  /**
   * Déplacement voulu par l'utilisateur. Sortir du passage bouclé arrête la boucle : on veut aller
   * ailleurs. Renvoie vrai dans ce cas.
   */
  function seekTo(time: number): boolean {
    const video = videoRef.current
    if (!video) return false
    const limit = Number.isFinite(video.duration) ? video.duration : Infinity
    const target = Math.min(limit, Math.max(0, time))
    const state = currentLoop()
    const leavesLoop = state.active && hasRegion(state) && (target < state.start || target > state.end)
    if (leavesLoop) {
      setLoop({ ...state, active: false })
      say('Boucle arrêtée')
    }
    video.currentTime = target
    return leavesLoop
  }

  function nudge(seconds: number) {
    const leftLoop = seekTo(now() + seconds)
    say(`${seconds > 0 ? '+' : '−'}${Math.abs(seconds)} s${leftLoop ? ' · boucle arrêtée' : ''}`)
  }

  function changeRate(next: number) {
    latestRate.current = next
    onRateChange(next)
    say(`Vitesse ${rateLabel(next)}×`)
  }

  function toggleMute() {
    // Remettre le son alors que le volume est à zéro ne servirait à rien : on le remonte à mi-course.
    const next = sound.muted
      ? { volume: sound.volume > 0 ? sound.volume : 0.5, muted: false }
      : { ...sound, muted: true }
    onSoundChange(next)
    say(next.muted ? 'Son coupé' : 'Son remis')
  }

  function markLoopStart() {
    const time = now()
    const { end, active } = currentLoop()
    const keepsEnd = end !== null && end > time
    setLoop({ start: time, end: keepsEnd ? end : null, active: keepsEnd && active })
    say(`Début de la boucle : ${formatTime(time)}`)
  }

  function markLoopEnd() {
    const time = now()
    const start = currentLoop().start ?? 0
    if (time <= start) {
      say('La fin doit être après le début')
      return
    }
    setLoop({ start, end: time, active: true })
    say(`Boucle ${formatTime(start)} → ${formatTime(time)}`)
  }

  function toggleLoop() {
    const state = currentLoop()
    if (!hasRegion(state)) {
      say('Placez d\'abord le début (A) et la fin (B)')
      return
    }
    setLoop({ ...state, active: !state.active })
    say(state.active ? 'Boucle arrêtée' : 'Boucle active')
  }

  function setMarks(next: Bookmark[]) {
    latestMarks.current = next
    onAnnotationsChange({ bookmarks: next })
  }

  function addMark(mark: Omit<Bookmark, 'id' | 'label'>) {
    setMarks([...latestMarks.current, { ...mark, id: newId(), label: '' }].sort((a, b) => a.time - b.time))
    say(
      mark.end === undefined
        ? `Repère posé à ${formatTime(mark.time)}`
        : `Passage gardé : ${formatTime(mark.time)} → ${formatTime(mark.end)}`,
    )
  }

  function keepLoop() {
    const state = currentLoop()
    if (hasRegion(state)) addMark({ time: state.start, end: state.end })
  }

  /** Lance la lecture à un repère ; pour un passage, en boucle. */
  function goToMark(mark: Bookmark) {
    const video = videoRef.current
    if (!video) return
    if (mark.end !== undefined) {
      setLoop({ start: mark.time, end: mark.end, active: true })
      video.currentTime = mark.time
    } else {
      seekTo(mark.time)
    }
    video.play().catch(() => undefined)
  }

  function perform(action: ShortcutAction) {
    switch (action) {
      case 'playPause':
        togglePlay()
        break
      case 'back':
        nudge(-SEEK_SECONDS)
        break
      case 'forward':
        nudge(SEEK_SECONDS)
        break
      case 'mute':
        toggleMute()
        break
      case 'fullscreen':
        toggleFullscreen(stageRef.current)
        break
      case 'loopStart':
        markLoopStart()
        break
      case 'loopEnd':
        markLoopEnd()
        break
      case 'loopToggle':
        toggleLoop()
        break
      case 'bookmark':
        addMark({ time: now() })
        break
      case 'slower':
        changeRate(stepRate(latestRate.current, -1))
        break
      case 'faster':
        changeRate(stepRate(latestRate.current, 1))
        break
      case 'next':
        if (onNext) onNext()
        else say('C\'est la dernière leçon')
        break
      case 'previous':
        if (onPrevious) onPrevious()
        else say('C\'est la première leçon')
        break
      case 'help':
        onHelp()
        break
    }
  }
  useShortcuts(perform)

  const done = progress?.completed ?? false
  const resume = resumePosition(progress)
  const { tabs: tabCount, backingTracks: trackCount } = resourceSummary(lesson)
  const meta = [
    done ? 'Leçon terminée' : resume > 0 ? `Reprise à ${formatTime(resume)}` : 'Pas encore commencée',
    tabCount > 0 && plural(tabCount, 'tablature'),
    trackCount > 0 && plural(trackCount, 'backing track'),
  ].filter(Boolean)
  const tabs = lesson.resources.filter((file) => file.kind === 'tab')
  const tracks = lesson.resources.filter((file) => file.kind === 'audio')

  return (
    <article className="lesson-view" data-finish={finish.id}>
      <div className="above">
        <header className="marquee">
          <p className="chip" title={`Leçon ${place.rank} sur ${place.total}`}>
            <span className="sr-only">
              Leçon {place.rank} sur {place.total}
            </span>
            <span className="chip-field" aria-hidden="true">
              <b>{String(place.rank).padStart(2, '0')}</b>
              <i>/{place.total}</i>
            </span>
            <span className="chip-name" aria-hidden="true">
              {finish.name}
            </span>
          </p>
          <div className="marquee-text">
            {crumbs.length > 0 && (
              <p className="crumb">
                {crumbs.map((crumb, index) => (
                  <span key={`${index}-${crumb}`}>{crumb}</span>
                ))}
              </p>
            )}
            <h2 className="title">{lesson.title}</h2>
            <p className="meta">{meta.join(' · ')}</p>
          </div>
          <div className="actions">
            <span className="pager">
              <button
                type="button"
                className="btn btn-icon"
                disabled={!onPrevious}
                aria-label="Leçon précédente"
                title="Leçon précédente (P)"
                onClick={() => onPrevious?.()}
              >
                <Icon name="chevronLeft" />
              </button>
              <button
                type="button"
                className="btn btn-icon"
                disabled={!onNext}
                aria-label="Leçon suivante"
                title="Leçon suivante (N)"
                onClick={() => onNext?.()}
              >
                <Icon name="chevronRight" />
              </button>
            </span>
            <button
              type="button"
              className="btn btn-icon btn-star"
              aria-pressed={favorite}
              aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={onToggleFavorite}
            >
              <Icon name={favorite ? 'starFilled' : 'star'} />
            </button>
            {/* À l'étroit, le libellé s'efface et il ne reste que la coche : aria-label garde alors le nom du bouton. */}
            <button
              type="button"
              className={done ? 'btn btn-done' : 'btn btn-done btn-solid'}
              aria-pressed={done}
              aria-label={done ? 'Terminée' : 'Marquer terminée'}
              title={done ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
              onClick={onToggleDone}
            >
              <Icon name="check" />
              <span>{done ? 'Terminée' : 'Marquer terminée'}</span>
            </button>
          </div>
        </header>

        <Stage
          file={lesson.video}
          videoRef={videoRef}
          stageRef={stageRef}
          videoHandlers={videoHandlers}
          rate={rate}
          sound={sound}
          fullscreen={fullscreen}
          message={message}
          onTogglePlay={togglePlay}
          onToggleFullscreen={() => toggleFullscreen(stageRef.current)}
        >
          <Pedal
            videoRef={videoRef}
            loop={loop}
            marks={marks}
            rate={rate}
            sound={sound}
            fullscreen={fullscreen}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            onRate={changeRate}
            onLoopStart={markLoopStart}
            onLoopEnd={markLoopEnd}
            onLoopToggle={toggleLoop}
            onLoopClear={() => setLoop(NO_LOOP)}
            onLoopKeep={keepLoop}
            onAddMark={() => addMark({ time: now() })}
            onMark={goToMark}
            onSound={onSoundChange}
            onToggleMute={toggleMute}
            onToggleFullscreen={() => toggleFullscreen(stageRef.current)}
          />
        </Stage>
      </div>

      <div className="bench">
        <Marks
          marks={marks}
          onGo={goToMark}
          onRename={(mark, label) => setMarks(latestMarks.current.map((m) => (m.id === mark.id ? { ...m, label } : m)))}
          onDelete={(mark) => setMarks(latestMarks.current.filter((m) => m.id !== mark.id))}
        />
        <Notes
          value={annotations.notes}
          onChange={(notes) => onAnnotationsChange({ notes })}
          onBlur={onAnnotationsBlur}
        />
        {(tabs.length > 0 || tracks.length > 0) && (
          <div className="bench-stack">
            {tabs.length > 0 && <Tablatures files={tabs} />}
            {tracks.length > 0 && <BackingTracks files={tracks} />}
          </div>
        )}
      </div>
    </article>
  )
}
