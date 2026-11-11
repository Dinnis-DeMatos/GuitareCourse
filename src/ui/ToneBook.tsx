import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import {
  DEFAULT_KNOBS,
  KNOB_MAX,
  MAX_KNOBS,
  MAX_LABEL,
  MAX_PEDALS,
  MAX_SETTINGS,
  MAX_TONES,
  MAX_TONE_NAME,
  MAX_TONE_NOTES,
  filterTones,
  type Tone,
} from '../tones.ts'
import { Icon } from './Icon.tsx'

/** « 8,5 » : la virgule à la française. */
const format = (value: number) => value.toLocaleString('fr-FR')

/** Un potard d'ampli : l'index tourne de -135° (0) à +135° (10), comme sur la façade. */
function Dial({ label, value }: { label: string; value: number }) {
  const angle = -135 + (value / KNOB_MAX) * 270
  return (
    <figure className="dial">
      <svg viewBox="0 0 48 48" role="img" aria-label={`${label} : ${format(value)}`}>
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1="24" y1="2" x2="24" y2={i % 5 === 0 ? 7 : 5} className="dial-tick" transform={`rotate(${-135 + i * 27} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="14" className="dial-cap" />
        <line x1="24" y1="24" x2="24" y2="12" className="dial-index" transform={`rotate(${angle} 24 24)`} />
      </svg>
      <span className="dial-value">{format(value)}</span>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

async function save(id: string, tone: Tone | null): Promise<Tone[]> {
  const response = await fetch('/api/tones', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, tone }),
  })
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
  return response.json()
}

type Busy = 'save' | 'delete' | null

const blank = (): Tone => ({ id: crypto.randomUUID(), artist: '', name: '', amp: '', knobs: DEFAULT_KNOBS, pedals: [], notes: '' })

function Editor({
  draft,
  isNew,
  busy,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Tone
  isNew: boolean
  busy: Busy
  onChange: (draft: Tone) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const id = useId()
  const [confirming, setConfirming] = useState(false)
  const { knobs, pedals } = draft
  return (
    <form
      className="chord-editor"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <div className="chord-fields tone-fields">
        <div>
          <label htmlFor={`${id}-artist`} className="silk">
            Groupe / artiste
          </label>
          <input
            id={`${id}-artist`}
            className="chord-input chord-input-big"
            value={draft.artist}
            maxLength={MAX_TONE_NAME}
            placeholder="Linkin Park"
            autoFocus
            onChange={(event) => onChange({ ...draft, artist: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${id}-name`} className="silk">
            Titre
          </label>
          <input
            id={`${id}-name`}
            className="chord-input chord-input-big"
            value={draft.name}
            maxLength={MAX_TONE_NAME}
            placeholder="In the End"
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </div>
        <div className="tone-amp">
          <label htmlFor={`${id}-amp`} className="silk">
            Ampli
          </label>
          <input
            id={`${id}-amp`}
            className="chord-input"
            value={draft.amp}
            maxLength={MAX_TONE_NAME}
            placeholder="Facultatif : modèle, canal…"
            onChange={(event) => onChange({ ...draft, amp: event.target.value })}
          />
        </div>
      </div>

      <span className="silk">Réglages de l'ampli</span>
      <ul className="tone-rows">
        {knobs.map((knob, index) => (
          <li key={index} className="tone-knob-row">
            <input
              className="chord-input"
              value={knob.label}
              maxLength={MAX_LABEL}
              aria-label={`Nom du bouton ${index + 1}`}
              placeholder="Bouton"
              onChange={(event) => onChange({ ...draft, knobs: knobs.with(index, { ...knob, label: event.target.value }) })}
            />
            <input
              type="range"
              className="fader tone-fader"
              min={0}
              max={KNOB_MAX}
              step={0.5}
              value={knob.value}
              aria-label={knob.label || `Bouton ${index + 1}`}
              style={{ '--v': `${(knob.value / KNOB_MAX) * 100}%` } as CSSProperties}
              onChange={(event) => onChange({ ...draft, knobs: knobs.with(index, { ...knob, value: Number(event.target.value) }) })}
            />
            <output className="tone-value">{format(knob.value)}</output>
            <button
              type="button"
              className="btn btn-icon"
              aria-label={`Retirer ${knob.label || 'ce bouton'}`}
              onClick={() => onChange({ ...draft, knobs: knobs.toSpliced(index, 1) })}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn tone-add"
        disabled={knobs.length >= MAX_KNOBS}
        onClick={() => onChange({ ...draft, knobs: [...knobs, { label: '', value: 5 }] })}
      >
        <Icon name="plus" />
        Ajouter un bouton
      </button>

      <span className="silk">Pédales, de la guitare vers l'ampli</span>
      {pedals.length > 0 && (
        <ul className="tone-rows">
          {pedals.map((pedal, index) => (
            <li key={index} className="tone-pedal-row">
              <input
                className="chord-input"
                value={pedal.name}
                maxLength={MAX_LABEL}
                aria-label={`Pédale ${index + 1}`}
                placeholder="Tube Screamer"
                onChange={(event) => onChange({ ...draft, pedals: pedals.with(index, { ...pedal, name: event.target.value }) })}
              />
              <input
                className="chord-input"
                value={pedal.settings}
                maxLength={MAX_SETTINGS}
                aria-label={`Réglages de la pédale ${index + 1}`}
                placeholder="Drive 6, Tone 5, Level 7"
                onChange={(event) => onChange({ ...draft, pedals: pedals.with(index, { ...pedal, settings: event.target.value }) })}
              />
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Retirer ${pedal.name || 'cette pédale'}`}
                onClick={() => onChange({ ...draft, pedals: pedals.toSpliced(index, 1) })}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn tone-add"
        disabled={pedals.length >= MAX_PEDALS}
        onClick={() => onChange({ ...draft, pedals: [...pedals, { name: '', settings: '' }] })}
      >
        <Icon name="plus" />
        Ajouter une pédale
      </button>

      <label htmlFor={`${id}-notes`} className="silk">
        Note
      </label>
      <textarea
        id={`${id}-notes`}
        className="chord-input"
        rows={2}
        value={draft.notes}
        maxLength={MAX_TONE_NOTES}
        placeholder="Micro chevalet, guitare accordée en Drop D…"
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
 * Les sons en fenêtre : les réglages d'ampli et de pédales qu'on a trouvés, pour les retrouver tels quels.
 * `start` : le son à montrer dès l'ouverture (trouvé par la recherche).
 */
export function ToneBook({ open, start = null, onClose }: { open: boolean; start?: Tone | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [list, setList] = useState<Tone[] | null>(null)
  const [draft, setDraft] = useState<Tone | null>(null)
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
      if (start) setDraft(start)
      fetch('/api/tones')
        .then((response) => (response.ok ? (response.json() as Promise<Tone[]>) : Promise.reject()))
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
  }, [open, start])

  const known = list?.find((t) => t.id === draft?.id)
  const isNew = draft !== null && !known
  const full = (list?.length ?? 0) >= MAX_TONES
  const shown = list ? filterTones(list, query) : []
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(known ?? { ...blank(), id: draft.id })

  const write = (id: string, tone: Tone | null) => {
    setBusy(tone ? 'save' : 'delete')
    return save(id, tone)
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
      artist: draft.artist.trim(),
      name: draft.name.trim() || 'Sans titre',
      amp: draft.amp.trim(),
      knobs: draft.knobs.map((k) => ({ ...k, label: k.label.trim() })).filter((k) => k.label !== ''),
      pedals: draft.pedals.map((p) => ({ name: p.name.trim(), settings: p.settings.trim() })).filter((p) => p.name !== '' || p.settings !== ''),
    })
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet chords-sheet"
      aria-labelledby="tones-title"
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
              <h2 id="tones-title">Sons</h2>
            </div>
            <button type="button" className="btn" onClick={() => (dirty ? setLeaving(true) : onClose())}>
              <Icon name="close" />
              Fermer
            </button>
          </div>
        )}

        {error && (
          <p className="notice" role="alert">
            <b>Enregistrement impossible.</b> Les sons n'ont pas pu être lus ou modifiés.
          </p>
        )}

        {leaving ? (
          <div className="chord-leave" role="alert">
            <h2 id="tones-title">Fermer sans enregistrer ?</h2>
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
              Nouveau son
            </button>
            {full && <p className="chord-empty">La liste est pleine : {MAX_TONES} sons au plus. Supprimez-en un pour en noter un autre.</p>}
            {list?.length === 0 && (
              <p className="chord-empty">
                Notez ici les réglages d'ampli et de pédales d'un son que vous avez trouvé, pour le retrouver tel quel la prochaine fois.
              </p>
            )}
            {list && list.length > 0 && (
              <>
                <label htmlFor="tones-search" className="silk tone-search-label">
                  Rechercher · {list.length} son{list.length > 1 ? 's' : ''}
                </label>
                <input
                  id="tones-search"
                  type="search"
                  className="chord-input tone-search"
                  value={query}
                  placeholder="Groupe, titre, ampli, pédale ou note"
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                />
                {shown.length === 0 && <p className="chord-empty">Aucun son ne correspond à « {query.trim()} ».</p>}
              </>
            )}
            <ul className="chord-list">
              {shown.map((tone) => (
                <li key={tone.id}>
                  <div className="chord-list-head">
                    <h3>
                      {tone.artist && <span className="tone-artist">{tone.artist}</span>}
                      {tone.name}
                    </h3>
                    {tone.amp && <span className="silk">{tone.amp}</span>}
                    <button type="button" className="btn chord-play" onClick={() => setDraft(tone)}>
                      Modifier
                    </button>
                  </div>
                  {tone.knobs.length > 0 && (
                    <div className="tone-dials">
                      {tone.knobs.map((knob, index) => (
                        <Dial key={index} label={knob.label} value={knob.value} />
                      ))}
                    </div>
                  )}
                  {tone.pedals.length > 0 && (
                    <ol className="tone-chain" aria-label="Pédales, de la guitare vers l'ampli">
                      {tone.pedals.map((pedal, index) => (
                        <li key={index}>
                          <b>{pedal.name}</b>
                          {pedal.settings && <span>{pedal.settings}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {tone.notes && <p className="chord-notes">{tone.notes}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  )
}
