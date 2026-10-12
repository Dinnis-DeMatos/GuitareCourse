import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** Passage à rejouer en boucle : du début (touche A) à la fin (touche B). */
export interface Loop {
  start: number | null
  end: number | null
  active: boolean
}

export const NO_LOOP: Loop = { start: null, end: null, active: false }

/** Vrai quand les deux bornes sont posées dans le bon ordre : la boucle peut tourner. */
export function hasRegion(loop: Loop): loop is Loop & { start: number; end: number } {
  return loop.start !== null && loop.end !== null && loop.end > loop.start
}

/**
 * Boucle sur un passage de la vidéo. `current` donne l'état le plus récent sans attendre le rendu
 * suivant : deux actions très rapprochées (raccourcis clavier) ne se marchent pas dessus.
 */
export function useLoop(mediaRef: RefObject<HTMLMediaElement | null>) {
  const [loop, setLoopState] = useState<Loop>(NO_LOOP)
  const latest = useRef<Loop>(NO_LOOP)

  const setLoop = useCallback((next: Loop) => {
    latest.current = next
    setLoopState(next)
  }, [])
  const current = useCallback(() => latest.current, [])

  useEffect(() => {
    if (!loop.active || !hasRegion(loop)) return
    const media = mediaRef.current
    if (!media) return
    const { start, end } = loop
    // La boucle s'active alors qu'on est ailleurs dans la vidéo : on vient se placer à son début.
    if (media.currentTime < start || media.currentTime >= end) media.currentTime = start
    // On surveille la lecture toutes les 20 ms (« timeupdate » est trop lent : ~4 fois par seconde,
    // la fin serait dépassée de plusieurs dixièmes). Un minuteur, plutôt que requestAnimationFrame,
    // continue de tourner quand l'onglet n'est pas au premier plan.
    const timer = window.setInterval(() => {
      if (!media.paused && media.currentTime >= end) media.currentTime = start
    }, 20)
    return () => window.clearInterval(timer)
  }, [loop, mediaRef])

  return { loop, setLoop, current }
}
