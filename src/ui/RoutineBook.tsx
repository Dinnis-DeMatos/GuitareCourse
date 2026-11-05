import { useEffect, useId, useRef, useState } from 'react'
import {
  MAX_ROUTINES,
  MAX_ROUTINE_NAME,
  MAX_ROUTINE_NOTES,
  MAX_STEPS,
  MAX_STEP_DETAILS,
  MAX_STEP_MINUTES,
  MAX_STEP_NAME,
  filterRoutines,
  formatMinutes,
  totalMinutes,
  stepInfo,
  type Routine,
} from '../routines.ts'
import { MAX_BPM, MIN_BPM, clampBpm } from '../metronome.ts'
import { Icon } from './Icon.tsx'

async function save(id: string, routine: Routine | null): Promise<Routine[]> {
  const response = await fetch('/api/routines', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, routine }),
  })
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
  return response.json()
}

type Busy = 'save' | 'delete' | null

const blank = (): Routine => ({ id: crypto.randomUUID(), name: '', steps: [{ name: '', minutes: 5, details: '' }], notes: '' })

/** Une durée tapée au clavier, ramenée entre 1 et le maximum à l'enregistrement (le champ peut rester vide pendant la saisie). */
const clampMinutes = (value: number) => Math.min(MAX_STEP_MINUTES, Math.max(1, Math.round(value) || 1))

function Editor({
  draft,
  isNew,
  busy,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Routine
  isNew: boolean
  busy: Busy
  onChange: (draft: Routine) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const id = useId()
  const [confirming, setConfirming] = useState(false)
  const { steps } = draft
  const move = (from: number, to: number) => onChange({ ...draft, steps: steps.toSpliced(from, 1).toSpliced(to, 0, steps[from]) })
  return (
    <form
      className="chord-editor"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <label htmlFor={`${id}-name`} className="silk">
        Nom de la routine
      </label>
      <input
        id={`${id}-name`}
        className="chord-input chord-input-big"
        value={draft.name}
        maxLength={MAX_ROUTINE_NAME}
        placeholder="Échauffement du matin"
        autoFocus
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
      />

      <span className="silk">Exercices, dans l'ordre · {formatMinutes(totalMinutes(draft))}</span>
      {steps.length > 0 && (
        <ol className="tone-rows">
          {steps.map((step, index) => (
            <li key={index} className="routine-step-row">
              <span className="routine-index">{index + 1}</span>
              <input
                className="chord-input"
                value={step.name}
                maxLength={MAX_STEP_NAME}
                aria-label={`Exercice ${index + 1}`}
                placeholder="Gamme pentatonique de La"
                onChange={(event) => onChange({ ...draft, steps: steps.with(index, { ...step, name: event.target.value }) })}
              />
              <span className="routine-minutes">
                <input
                  type="number"
                  className="chord-input"
                  min={1}
                  max={MAX_STEP_MINUTES}
                  value={step.minutes || ''}
                  aria-label={`Durée de l'exercice ${index + 1}, en minutes`}
                  onChange={(event) => onChange({ ...draft, steps: steps.with(index, { ...step, minutes: event.target.valueAsNumber || 0 }) })}
                />
                min
              </span>
              <span className="routine-minutes">
                <input
                  type="number"
                  className="chord-input"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  value={step.bpm || ''}
                  placeholder="—"
                  aria-label={`Tempo de l'exercice ${index + 1}, en BPM (facultatif)`}
                  onChange={(event) => onChange({ ...draft, steps: steps.with(index, { ...step, bpm: event.target.valueAsNumber || undefined }) })}
                />
                BPM
              </span>
              <input
                className="chord-input"
                value={step.details}
                maxLength={MAX_STEP_DETAILS}
                aria-label={`Détails de l'exercice ${index + 1}`}
                placeholder="Doigté, leçon, aller-retour…"
                onChange={(event) => onChange({ ...draft, steps: steps.with(index, { ...step, details: event.target.value }) })}
              />
              <span className="routine-step-actions">
                <button
                  type="button"
                  className="btn btn-icon"
                  disabled={index === 0}
                  aria-label={`Monter ${step.name || 'cet exercice'}`}
                  onClick={() => move(index, index - 1)}
                >
                  <Icon name="chevronUp" />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  disabled={index === steps.length - 1}
                  aria-label={`Descendre ${step.name || 'cet exercice'}`}
                  onClick={() => move(index, index + 1)}
                >
                  <Icon name="chevronDown" />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Retirer ${step.name || 'cet exercice'}`}
                  onClick={() => onChange({ ...draft, steps: steps.toSpliced(index, 1) })}
                >
                  <Icon name="close" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="btn tone-add"
        disabled={steps.length >= MAX_STEPS}
        onClick={() => onChange({ ...draft, steps: [...steps, { name: '', minutes: 5, details: '' }] })}
      >
        <Icon name="plus" />
        Ajouter un exercice
      </button>

      <label htmlFor={`${id}-notes`} className="silk">
        Note
      </label>
      <textarea
        id={`${id}-notes`}
        className="chord-input"
        rows={2}
        value={draft.notes}
        maxLength={MAX_ROUTINE_NOTES}
        placeholder="Objectif, quand la faire, ce qu'il faut surveiller…"
        onChange={(event) => onChange({ ...draft, notes: event.target.value })}
      />

      <div className="chord-actions" aria-busy={busy !== null}>
        <button type="submit" className="btn btn-solid" disabled={busy !== null} data-working={busy === 'save' || undefined}>
          {busy === 'save' ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" />}
          {busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={onCancel}>
          Annuler
        </button>
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
    </form>
  )
}

/** Les routines en fenêtre : les entraînements qu'on s'est préparés, pour les reprendre sans repartir de zéro. */
export function RoutineBook({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: (routine: Routine) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [list, setList] = useState<Routine[] | null>(null)
  const [draft, setDraft] = useState<Routine | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [leaving, setLeaving] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      element.focus()
      fetch('/api/routines')
        .then((response) => (response.ok ? (response.json() as Promise<Routine[]>) : Promise.reject()))
        .then(
          (saved) => {
            setList(saved)
            setError(false)
          },
          () => setError(true),
        )
    }
    if (!open) {
      setDraft(null)
      setQuery('')
      setLeaving(false)
      if (element.open) element.close()
    }
  }, [open])

  const known = list?.find((r) => r.id === draft?.id)
  const isNew = draft !== null && !known
  const full = (list?.length ?? 0) >= MAX_ROUTINES
  const shown = list ? filterRoutines(list, query) : []
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(known ?? { ...blank(), id: draft.id })

  const write = (id: string, routine: Routine | null) => {
    setBusy(routine ? 'save' : 'delete')
    return save(id, routine)
      .then(
        (saved) => {
          setList(saved)
          setDraft(null)
          setError(false)
        },
        () => setError(true),
      )
      .finally(() => setBusy(null))
  }

  const submit = () => {
    if (!draft) return
    const { updatedAt: _date, ...rest } = draft
    void write(draft.id, {
      ...rest,
      name: draft.name.trim() || 'Sans titre',
      steps: draft.steps
        .map((s) => ({ name: s.name.trim(), minutes: clampMinutes(s.minutes), ...(s.bpm ? { bpm: clampBpm(s.bpm) } : {}), details: s.details.trim() }))
        .filter((s) => s.name !== '' || s.details !== ''),
    })
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet chords-sheet"
      aria-labelledby="routines-title"
      data-leaving={leaving || undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !dirty) return
        event.preventDefault()
        setLeaving(!leaving)
      }}
      onCancel={(event) => {
        if (dirty) event.preventDefault()
      }}
      onClose={onClose}
    >
      <div className="sheet-body">
        {!leaving && (
          <div className="trainer-head">
            <div>
              <p className="sheet-kicker">Outil</p>
              <h2 id="routines-title">Routines</h2>
            </div>
            <button type="button" className="btn" onClick={() => (dirty ? setLeaving(true) : onClose())}>
              <Icon name="close" />
              Fermer
            </button>
          </div>
        )}

        {error && (
          <p className="notice" role="alert">
            <b>Enregistrement impossible.</b> Les routines n'ont pas pu être lues ou modifiées.
          </p>
        )}

        {leaving ? (
          <div className="chord-leave" role="alert">
            <h2 id="routines-title">Fermer sans enregistrer ?</h2>
            <p>Vos modifications seront perdues.</p>
            <div className="chord-actions">
              <button type="button" className="btn" autoFocus onClick={() => setLeaving(false)}>
                Continuer à modifier
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        ) : draft ? (
          <Editor
            draft={draft}
            isNew={isNew}
            busy={busy}
            onChange={setDraft}
            onSave={submit}
            onCancel={() => setDraft(null)}
            onDelete={() => void write(draft.id, null)}
          />
        ) : (
          <>
            <button type="button" className="btn btn-solid" disabled={full} onClick={() => setDraft(blank())}>
              <Icon name="plus" />
              Nouvelle routine
            </button>
            {full && <p className="chord-empty">La liste est pleine : {MAX_ROUTINES} routines au plus. Supprimez-en une pour en préparer une autre.</p>}
            {list?.length === 0 && (
              <p className="chord-empty">
                Préparez ici vos routines d'entraînement, exercice par exercice et minute par minute, pour les reprendre telles quelles la prochaine fois.
              </p>
            )}
            {list && list.length > 0 && (
              <>
                <label htmlFor="routines-search" className="silk tone-search-label">
                  Rechercher · {list.length} routine{list.length > 1 ? 's' : ''}
                </label>
                <input
                  id="routines-search"
                  type="search"
                  className="chord-input tone-search"
                  value={query}
                  placeholder="Nom, exercice ou note"
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                />
                {shown.length === 0 && <p className="chord-empty">Aucune routine ne correspond à « {query.trim()} ».</p>}
              </>
            )}
            <ul className="chord-list">
              {shown.map((routine) => (
                <li key={routine.id}>
                  <div className="chord-list-head">
                    <h3>{routine.name}</h3>
                    <span className="silk">{formatMinutes(totalMinutes(routine))}</span>
                    <button type="button" className="btn chord-play" onClick={() => setDraft(routine)}>
                      Modifier
                    </button>
                    <button type="button" className="btn btn-solid" disabled={routine.steps.length === 0} onClick={() => onStart(routine)}>
                      <Icon name="play" />
                      Lancer
                    </button>
                  </div>
                  {routine.steps.length > 0 && (
                    <ol className="routine-steps">
                      {routine.steps.map((step, index) => (
                        <li key={index}>
                          <span className="routine-time">{step.minutes} min</span>
                          <b>{step.name}</b>
                          {(step.bpm || step.details) && <span className="routine-details">{stepInfo(step)}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {routine.notes && <p className="chord-notes">{routine.notes}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  )
}
