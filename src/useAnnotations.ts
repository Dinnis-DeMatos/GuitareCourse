import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnnotationsMap, LessonAnnotations } from './courseTypes.ts'
import { putAnnotations } from './media.ts'

export const NO_ANNOTATIONS: LessonAnnotations = { notes: '', bookmarks: [] }

/** Délai après la dernière frappe avant d'envoyer au serveur. */
const SAVE_DELAY_MS = 600

/**
 * Notes et repères de toutes les leçons. Les modifications s'affichent tout de suite et partent
 * au serveur une fois la saisie calmée (ou à la fermeture de la page).
 */
export function useAnnotations(onSaveResult: (failed: boolean) => void) {
  const [annotations, setAnnotations] = useState<AnnotationsMap>({})
  const latest = useRef<AnnotationsMap>({})
  const timers = useRef(new Map<string, number>())
  const onSaveResultRef = useRef(onSaveResult)
  useEffect(() => {
    onSaveResultRef.current = onSaveResult
  })

  const apply = useCallback((next: AnnotationsMap) => {
    latest.current = next
    setAnnotations(next)
  }, [])

  /** Envoie tout de suite les annotations de la leçon `id` si une modification est en attente. */
  const flush = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer === undefined) return
    window.clearTimeout(timer)
    timers.current.delete(id)
    putAnnotations(id, latest.current[id] ?? NO_ANNOTATIONS).then(
      () => onSaveResultRef.current(false),
      () => onSaveResultRef.current(true),
    )
  }, [])

  const update = useCallback(
    (id: string, patch: Partial<LessonAnnotations>) => {
      apply({ ...latest.current, [id]: { ...(latest.current[id] ?? NO_ANNOTATIONS), ...patch } })
      const pending = timers.current.get(id)
      if (pending !== undefined) window.clearTimeout(pending)
      timers.current.set(id, window.setTimeout(() => flush(id), SAVE_DELAY_MS))
    },
    [apply, flush],
  )

  // Ne rien perdre en fermant la page avec une modification en attente.
  useEffect(() => {
    const pendingTimers = timers.current
    const onHide = () => [...pendingTimers.keys()].forEach(flush)
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flush])

  return { annotations, setAll: apply, update, flush }
}
