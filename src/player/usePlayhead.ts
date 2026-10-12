import { useEffect, type RefObject } from 'react'
import { formatTime } from '../progress.ts'
import { ratioOf } from '../staff.ts'

/**
 * Fait avancer la tête de lecture d'une barre (portée de la vidéo, corde d'un backing track).
 *
 * La position est écrite dans la variable CSS `--p` (de 0 à 1) de l'élément, image par image
 * pendant la lecture, sans repasser par React : c'est fluide et cela ne redessine rien d'autre.
 * La description pour les lecteurs d'écran (rôle « slider ») suit, quatre fois par seconde.
 */
export function usePlayhead(
  mediaRef: RefObject<HTMLMediaElement | null>,
  targetRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const media = mediaRef.current
    const target = targetRef.current
    if (!media || !target) return

    let frame = 0
    const paint = () => target.style.setProperty('--p', ratioOf(media.currentTime, media.duration).toFixed(5))
    const describe = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : 0
      target.setAttribute('aria-valuemax', String(Math.round(duration)))
      target.setAttribute('aria-valuenow', String(Math.round(media.currentTime)))
      target.setAttribute('aria-valuetext', `${formatTime(media.currentTime)} sur ${formatTime(duration)}`)
    }
    const tick = () => {
      paint()
      frame = requestAnimationFrame(tick)
    }
    const run = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tick)
    }
    const update = () => {
      paint()
      describe()
    }
    const rest = () => {
      cancelAnimationFrame(frame)
      update()
    }

    const listeners: [string, () => void][] = [
      ['play', run],
      ['pause', rest],
      ['ended', rest],
      ['emptied', rest],
      // « timeupdate » sert de filet : requestAnimationFrame est suspendu quand l'onglet est caché.
      ['timeupdate', update],
      ['seeking', update],
      ['seeked', update],
      ['loadedmetadata', update],
      ['durationchange', update],
    ]
    for (const [type, listener] of listeners) media.addEventListener(type, listener)
    if (media.paused) rest()
    else run()

    return () => {
      cancelAnimationFrame(frame)
      for (const [type, listener] of listeners) media.removeEventListener(type, listener)
    }
  }, [mediaRef, targetRef])
}
