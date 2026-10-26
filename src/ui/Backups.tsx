import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.tsx'

/** Mêmes données que server/backups.ts et server/jsonStore.ts. */
interface Backup {
  name: string
  files: string[]
}
export interface Recovery {
  file: string
  backup: string | null
  kept: string
}

const BEFORE_RESTORE = 'avant-restauration'

/** Ce que contient chaque fichier de données, en mots. */
const FILE_NAMES: Record<string, string> = {
  'progress.json': 'la progression',
  'favorites.json': 'les favoris',
  'annotations.json': 'les notes et repères',
  'trainer.json': "le suivi de l'exercice du manche",
  'chords.json': "le carnet d'accords",
}

const describeFile = (file: string) => FILE_NAMES[file] ?? file

/** « samedi 25 octobre » pour une sauvegarde du jour ; l'état d'avant la dernière restauration autrement. */
function backupLabel(name: string): string {
  if (name === BEFORE_RESTORE) return 'Avant la dernière restauration'
  const date = new Date(`${name}T12:00:00`)
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Prévient qu'un fichier de données était abîmé et dit ce qui l'a remplacé ; rien s'il n'y en a pas. */
export function RecoveryNotice({ recoveries }: { recoveries: Recovery[] }) {
  if (recoveries.length === 0) return null
  return (
    <div className="notice" role="alert">
      {recoveries.map((recovery) => (
        <p key={recovery.kept}>
          <b>Un fichier de données était abîmé : {describeFile(recovery.file)}.</b>{' '}
          {recovery.backup
            ? `Il a été remplacé par la sauvegarde du ${backupLabel(recovery.backup).toLowerCase()}.`
            : "Aucune sauvegarde n'était disponible : il repart de zéro."}{' '}
          L'original est gardé dans le dossier des données, sous « {recovery.kept} ».
        </p>
      ))}
    </div>
  )
}

/**
 * Les sauvegardes des données (une par jour, sept jours) : en remettre une remplace la progression, les
 * favoris, les notes, le suivi du manche et le carnet, puis recharge l'application.
 */
export function BackupsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [error, setError] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      setConfirming(null)
      setError(false)
      element.showModal()
      element.focus()
      fetch('/api/backups')
        .then((response) => (response.ok ? (response.json() as Promise<Backup[]>) : Promise.reject()))
        .then(setBackups, () => setError(true))
    }
    if (!open && element.open) element.close()
  }, [open])

  const restore = (name: string) => {
    setRestoring(name)
    fetch('/api/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then((response) => (response.ok ? window.location.reload() : Promise.reject()))
      .catch(() => {
        setRestoring(null)
        setError(true)
      })
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet backups-sheet"
      aria-labelledby="backups-title"
      onClose={onClose}
    >
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Options</p>
            <h2 id="backups-title">Sauvegardes</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            <Icon name="close" />
            Fermer
          </button>
        </div>
        <p className="backups-lead">
          Vos données sont sauvegardées chaque jour à l'ouverture de l'application ; les sept derniers jours sont
          gardés. Restaurer une sauvegarde remet votre progression, vos favoris, vos notes, le suivi du manche et le
          carnet d'accords dans l'état de ce jour-là. L'état actuel est gardé : vous pourrez y revenir.
        </p>
        {error && (
          <p className="notice" role="alert">
            <b>Sauvegardes inaccessibles.</b> Vérifiez que l'application est toujours lancée.
          </p>
        )}
        {backups?.length === 0 && <p className="backups-lead">Aucune sauvegarde pour l'instant.</p>}
        <ul className="backups-list" aria-busy={restoring !== null}>
          {backups?.map((backup) => (
            <li key={backup.name}>
              <div>
                <b>{backupLabel(backup.name)}</b>
                <span>{backup.files.map(describeFile).join(', ') || 'aucun fichier'}</span>
              </div>
              {confirming === backup.name ? (
                <span className="chord-delete" role="group" aria-label="Confirmer la restauration">
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={restoring !== null}
                    data-working={restoring === backup.name || undefined}
                    onClick={() => restore(backup.name)}
                  >
                    {restoring === backup.name && <span className="spinner" aria-hidden="true" />}
                    {restoring === backup.name ? 'Restauration…' : 'Restaurer et recharger'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={restoring !== null}
                    onClick={() => setConfirming(null)}
                  >
                    Annuler
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn"
                  disabled={restoring !== null || backup.files.length === 0}
                  onClick={() => setConfirming(backup.name)}
                >
                  Restaurer
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}
