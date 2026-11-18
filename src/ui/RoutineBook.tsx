import { useEffect, useId, useState } from 'react'
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
import { RoutinePlayer } from './RoutinePlayer.tsx'

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

/**
 * La page des routines : les entraînements qu'on s'est préparés, pour les reprendre sans repartir de zéro.
 * Trois colonnes : la liste (nouvelle routine, recherche), le contenu de la routine choisie, puis ce qu'on
 * en fait (la lancer ou la modifier), qui laisse place à la routine lancée ou à son éditeur.
 * Elle reste montée quand on va sur une autre page : une routine en cours de modification y est retrouvée.
 */
export function RoutineBook({
  open,
  practice,
  onStart,
  onStop,
}: {
  open: boolean
  /** La routine lancée, et quand : la relancer repart de zéro. Elle se joue à droite, à la place de sa fiche. */
  practice: { routine: Routine; started: number } | null
  onStart: (routine: Routine) => void
  onStop: () => void
}) {
  const [list, setList] = useState<Routine[] | null>(null)
  const [draft, setDraft] = useState<Routine | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Relue à chaque arrivée sur la page.
  useEffect(() => {
    if (!open) return
    fetch('/api/routines')
      .then((response) => (response.ok ? (response.json() as Promise<Routine[]>) : Promise.reject()))
      .then(
        (saved) => {
          setList(saved)
          setError(false)
        },
        () => setError(true),
      )
  }, [open])

  const known = list?.find((r) => r.id === draft?.id)
  const isNew = draft !== null && !known
  const full = (list?.length ?? 0) >= MAX_ROUTINES
  const shown = list ? filterRoutines(list, query) : []
  // La routine affichée à droite : celle qu'on a choisie, sinon la première de la liste.
  const selected = shown.find((r) => r.id === selectedId) ?? shown[0] ?? null
  // Au milieu : la routine en cours, sinon celle qu'on modifie (elle suit la saisie), sinon celle choisie.
  const shownRoutine = practice?.routine ?? draft ?? selected
  // Pendant une modification ou une routine en cours, la liste attend.
  const locked = draft !== null || practice !== null

  const write = (id: string, routine: Routine | null) => {
    setBusy(routine ? 'save' : 'delete')
    return save(id, routine)
      .then(
        (saved) => {
          setList(saved)
          setDraft(null)
          setError(false)
          // Enregistrée : on la montre ; supprimée : la première de la liste prend sa place.
          setSelectedId(routine ? id : null)
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
    <section className="page" hidden={!open} aria-labelledby="routines-title">
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Entraînement</p>
            <h2 id="routines-title">Routines</h2>
          </div>
        </div>

        {error && (
          <p className="notice" role="alert">
            <b>Enregistrement impossible.</b> Les routines n'ont pas pu être lues ou modifiées.
          </p>
        )}

        <div className="routines-layout">
          <div className="routines-index">
            {/* Pendant une modification ou une routine en cours, la liste attend : on termine d'abord. */}
            <button type="button" className="btn btn-solid" disabled={full || locked} onClick={() => setDraft(blank())}>
              <Icon name="plus" />
              Nouvelle routine
            </button>
            {full && <p className="chord-empty">La liste est pleine : {MAX_ROUTINES} routines au plus. Supprimez-en une pour en préparer une autre.</p>}
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
            <ul className="routines-list">
              {shown.map((routine) => (
                <li key={routine.id}>
                  <button
                    type="button"
                    aria-current={!draft && routine.id === (practice?.routine.id ?? selected?.id) ? 'true' : undefined}
                    disabled={locked}
                    onClick={() => setSelectedId(routine.id)}
                  >
                    <span className="routines-name">{routine.name}</span>
                    <span className="silk">
                      {formatMinutes(totalMinutes(routine))} · {routine.steps.length} exercice{routine.steps.length > 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Au milieu, le contenu : la routine en cours, celle qu'on modifie (en direct), ou celle qu'on a choisie. */}
          <div className="routines-detail">
            {shownRoutine ? (
              <article aria-labelledby="routine-shown-title">
                <p className="silk routines-total">{formatMinutes(totalMinutes(shownRoutine))}</p>
                <h3 id="routine-shown-title" className="routines-title">
                  {shownRoutine.name.trim() || (draft ? 'Nouvelle routine' : 'Sans titre')}
                </h3>
                {shownRoutine.steps.length > 0 ? (
                  <ol className="routine-steps">
                    {shownRoutine.steps.map((step, index) => (
                      <li key={index}>
                        <span className="routine-time">{step.minutes} min</span>
                        <b>{step.name || 'Sans titre'}</b>
                        {(step.bpm || step.details) && <span className="routine-details">{stepInfo(step)}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="chord-empty">Aucun exercice pour l'instant.</p>
                )}
                {shownRoutine.notes && <p className="chord-notes">{shownRoutine.notes}</p>}
              </article>
            ) : (
              list?.length === 0 && (
                <p className="chord-empty">
                  Préparez ici vos routines d'entraînement, exercice par exercice et minute par minute, pour les reprendre telles quelles la prochaine fois.
                </p>
              )
            )}
          </div>

          {/* À droite, ce qu'on en fait : le choix entre lancer et modifier, puis la routine lancée ou son éditeur. */}
          <div className="routines-action">
            {practice ? (
              <RoutinePlayer key={practice.started} routine={practice.routine} active={open} onClose={onStop} />
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
              selected && (
                <div className="routines-choice">
                  <button
                    type="button"
                    className="routines-choice-play"
                    disabled={selected.steps.length === 0}
                    onClick={() => onStart(selected)}
                  >
                    <Icon name="play" />
                    <span className="routines-choice-label">Lancer</span>
                    <span className="routines-choice-text">
                      {selected.steps.length === 0
                        ? "Ajoutez d'abord un exercice."
                        : `${formatMinutes(totalMinutes(selected))} d'entraînement, exercice par exercice.`}
                    </span>
                  </button>
                  <button type="button" className="routines-choice-edit" onClick={() => setDraft(selected)}>
                    <Icon name="settings" />
                    <span className="routines-choice-label">Modifier</span>
                    <span className="routines-choice-text">Le nom, les exercices, leur durée et leur tempo.</span>
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
