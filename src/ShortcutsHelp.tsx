import { useEffect, useRef } from 'react'
import { SHORTCUT_HELP } from './shortcuts.ts'

/** Fenêtre qui liste les raccourcis clavier. Échap la ferme. */
export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="shortcuts"
      aria-labelledby="shortcuts-title"
      onClose={onClose}
      // Un clic sur le fond (hors de la boîte) ferme la fenêtre.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="shortcuts-box">
        <h2 id="shortcuts-title">Raccourcis clavier</h2>
        <dl>
          {SHORTCUT_HELP.map((line) => (
            <div key={line.label}>
              <dt>
                {line.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{line.label}</dd>
            </div>
          ))}
        </dl>
        <p className="hint">Ils fonctionnent tant que vous n'êtes pas en train d'écrire dans un champ (nom d'un repère, notes).</p>
        <button type="button" className="primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </dialog>
  )
}
