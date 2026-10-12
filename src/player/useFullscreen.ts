import { useEffect, useState, type RefObject } from 'react'

/** Vrai quand l'élément occupe tout l'écran. */
export function useFullscreen(ref: RefObject<HTMLElement | null>): boolean {
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const update = () => setFullscreen(ref.current !== null && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [ref])
  return fullscreen
}

/** Passe l'élément en plein écran, ou en sort. */
export function toggleFullscreen(element: HTMLElement | null) {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  else void element?.requestFullscreen?.().catch(() => undefined)
}

/**
 * Vrai après quelques secondes sans geste de l'utilisateur, tant que `enabled` l'est : sert à
 * escamoter les commandes et le pointeur en plein écran pendant la lecture.
 */
export function useIdle(enabled: boolean, delay = 2600): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let timer = window.setTimeout(() => setIdle(true), delay)
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), delay)
    }
    const events = ['pointermove', 'pointerdown', 'keydown'] as const
    for (const type of events) document.addEventListener(type, wake)
    return () => {
      window.clearTimeout(timer)
      for (const type of events) document.removeEventListener(type, wake)
      setIdle(false)
    }
  }, [enabled, delay])
  return enabled && idle
}
