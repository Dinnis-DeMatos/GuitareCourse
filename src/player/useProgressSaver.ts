import { useCallback, useEffect, useMemo, useRef, type SyntheticEvent } from 'react'
import type { CourseFile, VideoProgress } from '../courseTypes.ts'
import type { ProgressUpdate } from '../media.ts'
import { isCompleted, resumePosition } from '../progress.ts'

/** Intervalle minimal entre deux enregistrements pendant la lecture. */
const SAVE_EVERY_MS = 5000

type VideoEvent = SyntheticEvent<HTMLVideoElement>

/**
 * Reprise et enregistrement de la progression d'une vidéo. Renvoie les gestionnaires à poser sur
 * l'élément <video> : la lecture reprend où elle s'était arrêtée, et la position est enregistrée
 * régulièrement, à la pause, à la fin, en changeant de leçon et à la fermeture de la page.
 */
export function useProgressSaver(
  file: CourseFile,
  progress: VideoProgress | undefined,
  onSave: (file: CourseFile, update: ProgressUpdate) => void,
) {
  // Dernier état connu de la lecture ; `null` tant que la reprise n'est pas faite, pour ne jamais
  // écraser la progression enregistrée par une position 0 de début de chargement.
  const latest = useRef<{ position: number; duration: number } | null>(null)
  // Position à l'ouverture : une leçon seulement consultée (ni lue ni déplacée) n'est pas réenregistrée,
  // sinon elle deviendrait « la plus récente » et déplacerait le point de reprise.
  const openedAt = useRef<number | null>(null)
  const lastSavedAt = useRef(0)
  // La progression change à chaque enregistrement : on la lit via des refs pour ne pas relancer les effets.
  const progressRef = useRef(progress)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    progressRef.current = progress
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
      if (!state || (!ended && state.position === openedAt.current)) return
      lastSavedAt.current = Date.now()
      const done = ended || (progressRef.current?.completed ?? false) || isCompleted(state.position, state.duration)
      onSaveRef.current(file, { position: ended ? 0 : state.position, duration: state.duration, completed: done })
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

  return useMemo(
    () => ({
      onLoadedMetadata(event: VideoEvent) {
        const video = event.currentTarget
        const start = resumePosition(progressRef.current)
        if (start > 0 && start < video.duration) video.currentTime = start
        latest.current = { position: video.currentTime, duration: video.duration }
        openedAt.current = video.currentTime
      },
      onTimeUpdate(event: VideoEvent) {
        const video = event.currentTarget
        if (!latest.current) return
        latest.current = { position: video.currentTime, duration: video.duration }
        if (Date.now() - lastSavedAt.current >= SAVE_EVERY_MS) save()
      },
      onPause() {
        save()
      },
      onEnded() {
        save(true)
      },
    }),
    [save],
  )
}
