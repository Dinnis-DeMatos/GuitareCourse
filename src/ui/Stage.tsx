import { useEffect, useState, type ReactNode, type RefObject, type SyntheticEvent } from 'react'
import type { CourseFile } from '../courseTypes.ts'
import { mediaUrl } from '../media.ts'
import { useIdle } from '../player/useFullscreen.ts'
import { useMediaFlags } from '../player/useMedia.ts'
import { Icon } from './Icon.tsx'
import type { Sound } from './Pedal.tsx'

type VideoEvent = SyntheticEvent<HTMLVideoElement>

/**
 * La scène : la vidéo, sans les commandes du navigateur (elles sont remplacées par le pédalier, passé
 * en `children`), le médiator qui lance la leçon, et les messages affichés sur l'image.
 */
export function Stage({
  file,
  videoRef,
  stageRef,
  videoHandlers,
  rate,
  sound,
  fullscreen,
  message,
  onTogglePlay,
  onToggleFullscreen,
  children,
}: {
  file: CourseFile
  videoRef: RefObject<HTMLVideoElement | null>
  /** Le bloc qui passe en plein écran : la vidéo et ses commandes. */
  stageRef: RefObject<HTMLDivElement | null>
  videoHandlers: {
    onLoadedMetadata: (event: VideoEvent) => void
    onTimeUpdate: (event: VideoEvent) => void
    onPause: () => void
    onEnded: () => void
  }
  /** Vitesse de lecture (1 = normale). */
  rate: number
  sound: Sound
  fullscreen: boolean
  /** Message bref à afficher sur l'image ; vide s'il n'y en a pas. */
  message: string
  onTogglePlay: () => void
  onToggleFullscreen: () => void
  children: ReactNode
}) {
  const flags = useMediaFlags(videoRef)
  const idle = useIdle(fullscreen && !flags.paused)
  // Le médiator invite à lancer la leçon. Ensuite il ne revient plus : une pause sert à regarder les
  // mains, il ne faut rien poser dessus.
  const [started, setStarted] = useState(false)

  // La vitesse et le volume valent pour toutes les leçons : ils sont réappliqués à chaque vidéo.
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }, [rate, videoRef])
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = sound.volume
    video.muted = sound.muted
  }, [sound.volume, sound.muted, videoRef])

  // La vidéo prend le focus à l'ouverture d'une leçon : Espace, flèches… agissent aussitôt, au lieu
  // de réactiver le bouton cliqué juste avant.
  useEffect(() => {
    videoRef.current?.focus({ preventScroll: true })
  }, [videoRef])

  // « Lumières de salle » : pendant la lecture, la feuille de style atténue ce qui entoure l'image.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-playing', !flags.paused)
    return () => document.documentElement.removeAttribute('data-playing')
  }, [flags.paused])

  return (
    <div
      ref={stageRef}
      className="stage"
      data-fullscreen={fullscreen ? 'true' : undefined}
      data-idle={idle ? 'true' : undefined}
    >
      <div className="screen">
        <video
          ref={videoRef}
          src={mediaUrl(file)}
          preload="metadata"
          playsInline
          tabIndex={-1}
          onClick={onTogglePlay}
          onDoubleClick={onToggleFullscreen}
          onPlay={() => setStarted(true)}
          onTimeUpdate={videoHandlers.onTimeUpdate}
          onPause={videoHandlers.onPause}
          onEnded={videoHandlers.onEnded}
          onLoadedMetadata={(event) => {
            // Un nouveau fichier remet la vitesse à 1 : on rétablit celle qui a été choisie.
            event.currentTarget.playbackRate = rate
            videoHandlers.onLoadedMetadata(event)
          }}
        />
        {flags.failed ? (
          <p className="stage-error" role="alert">
            Cette vidéo ne peut pas être lue.
            <span>Le fichier est peut-être absent, ou dans un format que le navigateur ne lit pas.</span>
          </p>
        ) : (
          <>
            {flags.paused && !started && (
              <button type="button" className="bigplay" tabIndex={-1} onClick={onTogglePlay} aria-label="Lire la vidéo">
                <Icon name="pick" />
              </button>
            )}
            {flags.waiting && !flags.paused && (
              <div className="vu" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            )}
          </>
        )}
        <p className="osd" role="status" aria-live="polite">
          {message}
        </p>
      </div>
      {children}
    </div>
  )
}
