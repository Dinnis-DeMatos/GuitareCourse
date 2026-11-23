import { windowControl, type WindowAction } from '../desktop.ts'

/**
 * Les boutons de la fenêtre de bureau, en haut à droite, à la place de la barre de titre de Windows :
 * trois signes discrets dans une gélule ; la couleur ne vient qu'au survol. Absents dans le navigateur.
 */
const BUTTONS: { action: WindowAction; label: string; glyph: string }[] = [
  { action: 'minimize', label: 'Réduire', glyph: 'M2 5h6' },
  { action: 'maximize', label: 'Agrandir ou restaurer', glyph: 'M2.5 2.5h5v5h-5Z' },
  { action: 'close', label: 'Fermer', glyph: 'm2.5 2.5 5 5m0-5-5 5' },
]

export function WindowControls() {
  if (!windowControl) return null
  return (
    <div className="window-controls" role="group" aria-label="Fenêtre">
      {BUTTONS.map(({ action, label, glyph }) => (
        <button
          key={action}
          type="button"
          className="window-control"
          data-action={action}
          aria-label={label}
          title={label}
          onClick={() => windowControl?.(action)}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d={glyph} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}
