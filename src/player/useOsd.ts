import { useCallback, useEffect, useRef, useState } from 'react'

/** Durée d'affichage d'un message sur la vidéo. */
const VISIBLE_MS = 1600

/**
 * Message bref affiché sur la vidéo pour confirmer une action (« Vitesse 0,75× », « +5 s »…),
 * comme l'affichage d'un magnétoscope : la vidéo, elle, ne change pas d'apparence.
 */
export function useOsd() {
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)

  const say = useCallback((text: string) => {
    setMessage(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), VISIBLE_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { message, say }
}
