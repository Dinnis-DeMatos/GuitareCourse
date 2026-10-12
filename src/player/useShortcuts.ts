import { useEffect, useRef } from 'react'
import { isTypingTarget, resolveShortcut, type ShortcutAction } from '../shortcuts.ts'

/** Les commandes natives (Entrée, Espace) d'un bouton ou lien atteint au clavier restent à lui. */
function isKeyboardFocusedControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.matches('button, a[href], summary, [role="button"]') &&
    target.matches(':focus-visible')
  )
}

/** Branche les raccourcis clavier sur `perform`, qui exécute l'action correspondante. */
export function useShortcuts(perform: (action: ShortcutAction) => void) {
  // Le gestionnaire clavier est posé une seule fois : il passe par cette ref pour toujours appeler
  // la version de `perform` du dernier rendu (et donc voir l'état courant de la boucle, des repères…).
  const run = useRef(perform)
  useEffect(() => {
    run.current = perform
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      // Une touche maintenue ne répète que les flèches (reculer / avancer en continu).
      if (event.repeat && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const action = resolveShortcut(event)
      if (!action) return
      const target = event.target
      if (isTypingTarget(target)) return
      if (target instanceof Element && target.closest('dialog')) return
      // Espace sur un bouton atteint au clavier : c'est le bouton qui doit s'activer.
      if (action === 'playPause' && event.key === ' ' && isKeyboardFocusedControl(target)) return
      event.preventDefault()
      run.current(action)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
