import { useState } from 'react'
import { Icon } from './Icon.tsx'

/** Écriture en cours dans un carnet. */
export type Busy = 'save' | 'delete' | null

/** Bas des éditeurs des carnets (accords, routines, sons) : enregistrer, annuler, supprimer après confirmation. */
export function EditorActions({
  busy,
  isNew,
  canSave = true,
  onCancel,
  onDelete,
}: {
  busy: Busy
  isNew: boolean
  canSave?: boolean
  onCancel: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="chord-actions" aria-busy={busy !== null}>
      <button type="submit" className="btn btn-solid" disabled={!canSave || busy !== null} data-working={busy === 'save' || undefined}>
        {busy === 'save' ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" />}
        {busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <button type="button" className="btn" disabled={busy !== null} onClick={onCancel}>
        Annuler
      </button>
      {/* Confirmation sur place, pas par window.confirm : certaines fenêtres (l'aperçu) ne l'affichent pas. */}
      {!isNew &&
        (confirming ? (
          <span className="chord-delete" role="group" aria-label="Confirmer la suppression">
            <button type="button" className="btn btn-danger" disabled={busy !== null} data-working={busy === 'delete' || undefined} onClick={onDelete}>
              {busy === 'delete' && <span className="spinner" aria-hidden="true" />}
              {busy === 'delete' ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
            <button type="button" className="btn" disabled={busy !== null} onClick={() => setConfirming(false)}>
              Garder
            </button>
          </span>
        ) : (
          <button type="button" className="btn chord-delete" onClick={() => setConfirming(true)}>
            Supprimer
          </button>
        ))}
    </div>
  )
}
