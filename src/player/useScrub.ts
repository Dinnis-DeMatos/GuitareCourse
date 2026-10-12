import { useRef, useState, type PointerEvent } from 'react'
import { clampRatio } from '../staff.ts'

function ratioAt(element: HTMLElement, clientX: number): number {
  const box = element.getBoundingClientRect()
  return box.width > 0 ? clampRatio((clientX - box.left) / box.width) : 0
}

/**
 * Déplacement dans un média à la souris ou au doigt : un clic va à l'endroit visé, un glissement
 * suit le pointeur. Renvoie aussi la position survolée (de 0 à 1) pour afficher l'instant visé.
 */
export function useScrub(duration: number, onSeek: (time: number) => void) {
  const dragging = useRef(false)
  const [hover, setHover] = useState<number | null>(null)

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || !(duration > 0)) return
      dragging.current = true
      onSeek(ratioAt(event.currentTarget, event.clientX) * duration)
      // La capture permet de continuer à glisser hors de la barre ; sans elle, le clic suffit.
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Pointeur déjà relâché : rien à suivre.
      }
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!(duration > 0)) return
      const ratio = ratioAt(event.currentTarget, event.clientX)
      setHover(ratio)
      if (dragging.current) onSeek(ratio * duration)
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      dragging.current = false
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    onPointerCancel() {
      dragging.current = false
      setHover(null)
    },
    onPointerLeave() {
      if (!dragging.current) setHover(null)
    },
  }

  return { hover, handlers }
}
