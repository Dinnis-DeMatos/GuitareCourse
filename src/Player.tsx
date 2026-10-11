import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { CourseFile, VideoProgress } from './courseTypes.ts'
import { mediaUrl, type ProgressUpdate } from './media.ts'
import { isCompleted, resumePosition } from './progress.ts'

/** Intervalle minimal entre deux enregistrements pendant la lecture. */
const SAVE_EVERY_MS = 5000

export function Player({
  file,
  progress,
  videoRef,
  rate,
  onSave,
}: {
  file: CourseFile
  progress: VideoProgress | undefined
  /** Donne accès à la vidéo pour la boucle, les repères et la vitesse. */
  videoRef: RefObject<HTMLVideoElement | null>
  /** Vitesse de lecture (1 = normale). */
  rate: number
  onSave: (file: CourseFile, update: ProgressUpdate) => void
}) {
  // Dernier état connu de la lecture ; `null` tant que la reprise n'est pas faite, pour ne jamais
  // écraser la progression enregistrée par une position 0 de début de chargement.
  const latest = useRef<{ position: number; duration: number } | null>(null)
  const lastSavedAt = useRef(0)
  // La progression change à chaque enregistrement : on la lit via une ref pour ne pas relancer les effets.
  const completedBefore = useRef(progress?.completed ?? false)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    completedBefore.current = progress?.completed ?? false
    onSaveRef.current = onSave
  })

  // Leçon décochée pendant qu'elle est affichée : on oublie la position atteinte, sinon la
  // sauvegarde en quittant la page la re-cocherait (position ≥ 95 % de la durée).
  const completed = progress?.completed ?? false
  const wasCompleted = useRef(completed)
  useEffect(() => {
    if (wasCompleted.current && !completed && latest.current) {
      latest.current = { ...latest.current, position: 0 }
    }
    wasCompleted.current = completed
  }, [completed])

  const save = useCallback(
    (ended = false) => {
      const state = latest.current
      if (!state) return
      lastSavedAt.current = Date.now()
      const completed = ended || completedBefore.current || isCompleted(state.position, state.duration)
      onSaveRef.current(file, { position: ended ? 0 : state.position, duration: state.duration, completed })
    },
    [file],
  )

  // Enregistre en quittant la vidéo ou la page.
  useEffect(() => {
    const onHide = () => save()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      save()
    }
  }, [save])

  // La vitesse choisie vaut pour toutes les leçons : elle est réappliquée à chaque nouvelle vidéo.
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }, [rate, videoRef])

  return (
    <video
      ref={videoRef}
      className="player"
      src={mediaUrl(file)}
      controls
      preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget
        video.playbackRate = rate
        const start = resumePosition(progress)
        if (start > 0 && start < video.duration) video.currentTime = start
        latest.current = { position: video.currentTime, duration: video.duration }
      }}
      onTimeUpdate={(event) => {
        const video = event.currentTarget
        if (!latest.current) return
        latest.current = { position: video.currentTime, duration: video.duration }
        if (Date.now() - lastSavedAt.current >= SAVE_EVERY_MS) save()
      }}
      onPause={() => save()}
      onEnded={() => save(true)}
    />
  )
}
