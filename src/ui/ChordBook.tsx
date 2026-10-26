import { useEffect, useId, useRef, useState } from 'react'
import { SHOWN_FRETS, chordShape, detectChord, drawnShape, firstFret, fretsName, type Frets } from '../chords.ts'
import type { ChordProgression, Rhythm } from '../courseTypes.ts'
import { BEATS, MAX_BPM, MIN_BPM } from '../limits.ts'
import {
  DEFAULT_RHYTHM,
  MAX_CHORD_LENGTH,
  MAX_FRET,
  MAX_NAME_LENGTH,
  MAX_PROGRESSION_NOTES,
  SUBDIVISIONS,
  countLabel,
  resizeRhythm,
  splitChords,
} from '../progressions.ts'
import { Icon } from './Icon.tsx'

/**
 * Diagramme d'un accord : six cordes verticales, le sillet (ou la case de départ), les doigts.
 * `frets` : la position dessinée à la main, sinon celle de la bibliothèque.
 */
export function ChordDiagram({ name, frets }: { name: string; frets?: Frets }) {
  const shape = frets ? drawnShape(frets) : chordShape(name)
  const first = shape ? firstFret(shape.frets) : 1
  const x = (string: number) => 10 + string * 12
  const y = (fret: number) => 18 + (fret - first + 0.5) * 16
  const label = shape
    ? `${name} : ${shape.frets.map((f) => (f === null ? 'x' : f)).join(' ')}`
    : `${name} : position inconnue`

  return (
    <figure className="chord">
      <figcaption>{name}</figcaption>
      <svg viewBox="0 0 80 92" role="img" aria-label={label}>
        {shape ? (
          <>
            {first === 1 ? (
              <rect x={x(0)} y={16} width={60} height={3} fill="currentColor" />
            ) : (
              <text x={x(5) + 6} y={y(first) + 4} className="chord-fret">
                {first}
              </text>
            )}
            {Array.from({ length: SHOWN_FRETS + 1 }, (_, i) => (
              <line key={`f${i}`} x1={x(0)} x2={x(5)} y1={18 + i * 16} y2={18 + i * 16} className="chord-line" />
            ))}
            {shape.frets.map((fret, string) => (
              <g key={string}>
                <line x1={x(string)} x2={x(string)} y1={18} y2={18 + SHOWN_FRETS * 16} className="chord-line" />
                {fret === null && (
                  <path d={`M${x(string) - 3} 5l6 6m0-6-6 6`} className="chord-mute" />
                )}
                {fret === 0 && <circle cx={x(string)} cy={8} r={3} className="chord-open" />}
                {fret !== null && fret > 0 && !(shape.barre && fret === shape.barre.fret) && (
                  <circle cx={x(string)} cy={y(fret)} r={4.5} className="chord-dot" />
                )}
              </g>
            ))}
            {shape.barre && (
              <rect
                x={x(shape.barre.from) - 4.5}
                y={y(shape.barre.fret) - 4.5}
                width={x(shape.barre.to) - x(shape.barre.from) + 9}
                height={9}
                rx={4.5}
                className="chord-dot"
              />
            )}
          </>
        ) : (
          <text x={40} y={56} textAnchor="middle" className="chord-unknown">
            ?
          </text>
        )}
      </svg>
    </figure>
  )
}

async function save(id: string, progression: ChordProgression | null): Promise<ChordProgression[]> {
  const response = await fetch('/api/chords', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, progression }),
  })
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
  return response.json()
}

/** Écriture en cours dans le carnet. */
type Busy = 'save' | 'delete' | null

interface Draft {
  id: string
  name: string
  chords: string
  bpm: string
  notes: string
  shapes: Record<string, Frets>
  rhythm: Rhythm | null
}

const toDraft = (p: ChordProgression): Draft => ({
  id: p.id,
  name: p.name,
  chords: p.chords.join(' '),
  bpm: p.bpm ? String(p.bpm) : '',
  notes: p.notes,
  shapes: p.shapes ?? {},
  rhythm: p.rhythm ?? null,
})

const STROKE_GLYPHS: Record<string, string> = { D: '↓', U: '↑', X: '×', '-': '' }
const STROKE_NAMES: Record<string, string> = { D: 'vers le bas', U: 'vers le haut', X: 'étouffé', '-': 'silence' }
/** Un toucher fait passer le coup au suivant : silence, bas, haut, étouffé, puis silence. */
const NEXT_STROKE: Record<string, string> = { '-': 'D', D: 'U', U: 'X', X: '-' }

/**
 * Une mesure de rythmique, coup par coup ; `onStroke` la rend modifiable (un bouton par coup).
 * `activeBeat` : le temps qu'on joue, dont les coups s'allument.
 */
export function RhythmStrip({
  rhythm,
  onStroke,
  activeBeat,
}: {
  rhythm: Rhythm
  onStroke?: (index: number) => void
  activeBeat?: number | null
}) {
  return (
    <div className="rhythm-strip" role={onStroke ? 'group' : 'img'} aria-label={onStroke ? 'Coups de la mesure' : `Rythmique : ${[...rhythm.pattern].map((s) => STROKE_NAMES[s]).join(', ')}`}>
      {[...rhythm.pattern].map((stroke, index) => {
        const count = countLabel(index, rhythm.subdivision)
        const content = (
          <>
            <span className="rhythm-glyph" aria-hidden="true">
              {STROKE_GLYPHS[stroke]}
            </span>
            <span className="rhythm-count" aria-hidden="true">
              {count}
            </span>
          </>
        )
        const beatStart = index % rhythm.subdivision === 0 ? 'true' : undefined
        return onStroke ? (
          <button
            key={index}
            type="button"
            className="rhythm-cell"
            data-beat={beatStart}
            data-stroke={stroke}
            aria-label={`${count} : ${STROKE_NAMES[stroke]}`}
            onClick={() => onStroke(index)}
          >
            {content}
          </button>
        ) : (
          <span
            key={index}
            className="rhythm-cell"
            data-beat={beatStart}
            data-stroke={stroke}
            data-active={Math.floor(index / rhythm.subdivision) === activeBeat || undefined}
          >
            {content}
          </span>
        )
      })}
    </div>
  )
}

/** La rythmique, facultative : la mesure (temps, croches ou doubles croches) et ses coups. */
function RhythmEditor({ rhythm, onChange }: { rhythm: Rhythm; onChange: (rhythm: Rhythm | null) => void }) {
  return (
    <div className="rhythm-editor">
      <div className="rhythm-options">
        <span className="silk">Temps</span>
        {BEATS.map((beats) => (
          <button
            key={beats}
            type="button"
            className="btn btn-icon"
            aria-pressed={rhythm.beats === beats}
            onClick={() => onChange(resizeRhythm(rhythm, beats, rhythm.subdivision))}
          >
            {beats}
          </button>
        ))}
        <span className="silk">Coups</span>
        {SUBDIVISIONS.map((subdivision) => (
          <button
            key={subdivision}
            type="button"
            className="btn"
            aria-pressed={rhythm.subdivision === subdivision}
            onClick={() => onChange(resizeRhythm(rhythm, rhythm.beats, subdivision))}
          >
            {subdivision === 2 ? 'Croches' : 'Doubles croches'}
          </button>
        ))}
      </div>
      <RhythmStrip
        rhythm={rhythm}
        onStroke={(index) =>
          onChange({ ...rhythm, pattern: rhythm.pattern.slice(0, index) + NEXT_STROKE[rhythm.pattern[index]] + rhythm.pattern.slice(index + 1) })
        }
      />
      <p className="fret-editor-help">Touchez un coup pour passer de silence à bas (↓), haut (↑), étouffé (×).</p>
      <button type="button" className="btn rhythm-remove" onClick={() => onChange(null)}>
        Retirer la rythmique
      </button>
    </div>
  )
}

const STRINGS = ['Mi grave', 'La', 'Ré', 'Sol', 'Si', 'Mi aigu']

/**
 * Le diagramme à dessiner soi-même : une case touchée pose (ou retire) un doigt sur cette corde ; le
 * haut de la corde la fait jouer à vide ou l'étouffe. − et + déplacent la fenêtre sur le manche.
 */
function FretEditor({
  name,
  frets,
  drawn,
  onChange,
  onReset,
  onDone,
  onCancel,
}: {
  /** L'accord dont on redessine le diagramme ; null pour un nouvel accord, nommé d'après ses notes. */
  name: string | null
  frets: Frets
  drawn: boolean
  onChange: (frets: Frets) => void
  onReset: () => void
  /** Reçoit le nom retenu : celui qu'on a tapé, sinon l'accord reconnu. */
  onDone: (name: string) => void
  onCancel: () => void
}) {
  const id = useId()
  const [start, setStart] = useState(() => firstFret(frets))
  const rows = Array.from({ length: SHOWN_FRETS }, (_, i) => start + i)
  const set = (string: number, fret: number | null) => onChange(frets.with(string, fret))
  const detected = detectChord(frets)
  const sounding = frets.some((f) => f !== null)
  // Tant qu'on ne l'a pas tapé, le nom d'un nouvel accord suit ce que la grille reconnaît.
  const [typed, setTyped] = useState<string | null>(name)
  const chosen = typed ?? (sounding ? (detected ?? fretsName(frets)) : '')

  return (
    <div className="fret-editor">
      <div className="fret-editor-main">
        <p className="fret-editor-help">
          {name ? (
            <>
              Diagramme de <b>{name}</b> :{' '}
            </>
          ) : (
            'Nouvel accord : '
          )}
          touchez une case pour poser un doigt, le haut d'une corde pour la jouer à vide (o) ou l'étouffer (×).
        </p>
        <p className="fret-detected" aria-live="polite">
          <span className="silk">Accord reconnu</span>
          <b>{detected ?? (sounding ? `non répertorié (${fretsName(frets)})` : '—')}</b>
        </p>
        <div className="fret-name">
          <label htmlFor={`${id}-chord-name`} className="silk">
            Nom de l'accord
          </label>
          {/* Sans espace : dans le champ Accords, l'espace sépare deux accords. */}
          <input
            id={`${id}-chord-name`}
            className="chord-input"
            value={chosen}
            maxLength={MAX_CHORD_LENGTH}
            placeholder="Posez des doigts sur la grille"
            onChange={(event) => setTyped(event.target.value.replace(/[\s,;|]+/g, ''))}
            onKeyDown={(event) => {
              // Entrée valide l'accord, pas toute la suite (le champ est dans son formulaire).
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (chosen !== '' && (name || sounding)) onDone(chosen)
            }}
          />
          {typed !== null && detected && typed !== detected && (
            <button type="button" className="btn" onClick={() => setTyped(detected)}>
              Reprendre « {detected} »
            </button>
          )}
        </div>
        <div className="fret-grid" data-nut={start === 1 ? 'true' : undefined}>
          <span />
          {frets.map((fret, string) => (
            <button
              key={string}
              type="button"
              className="fret-top"
              aria-label={`${STRINGS[string]} : ${fret === null ? 'étouffée' : fret === 0 ? 'à vide' : `case ${fret}`}`}
              onClick={() => set(string, fret === 0 ? null : 0)}
            >
              {fret === null ? '×' : fret === 0 ? 'o' : ''}
            </button>
          ))}
          {rows.map((fret, row) => (
            <div key={fret} className="fret-row" data-first={row === 0 ? 'true' : undefined}>
              <span className="fret-number">{fret}</span>
              {frets.map((current, string) => (
                <button
                  key={string}
                  type="button"
                  className="fret-cell"
                  aria-pressed={current === fret}
                  aria-label={`${STRINGS[string]}, case ${fret}`}
                  onClick={() => set(string, current === fret ? 0 : fret)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="fret-editor-actions">
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Remonter vers le sillet"
            disabled={start === 1}
            onClick={() => setStart(start - 1)}
          >
            −
          </button>
          <span className="silk">Case {start}</span>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Descendre vers le chevalet"
            disabled={start + SHOWN_FRETS - 1 >= MAX_FRET}
            onClick={() => setStart(start + 1)}
          >
            +
          </button>
          {drawn && (
            <button type="button" className="btn" onClick={onReset}>
              Position automatique
            </button>
          )}
          {name ? (
            <button type="button" className="btn btn-solid" disabled={chosen === ''} onClick={() => onDone(chosen)}>
              <Icon name="check" />
              Terminé
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-solid"
                disabled={!sounding || chosen === ''}
                onClick={() => onDone(chosen)}
              >
                <Icon name="plus" />
                Ajouter à la suite
              </button>
              <button type="button" className="btn" onClick={onCancel}>
                Annuler
              </button>
            </>
          )}
        </div>
      </div>
      <ChordDiagram name={chosen || '—'} frets={frets} />
    </div>
  )
}

/** Formulaire d'une suite : le nom, les accords (avec leurs diagrammes au fil de la saisie), le tempo, une note. */
function Editor({
  draft,
  isNew,
  busy,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft
  isNew: boolean
  busy: Busy
  onChange: (draft: Draft) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const id = useId()
  const chords = splitChords(draft.chords)
  const [confirming, setConfirming] = useState(false)
  // L'accord dont on redessine le diagramme ; l'éditeur se ferme si on l'efface de la suite.
  const [drawing, setDrawing] = useState<string | null>(null)
  // Le nouvel accord qu'on dessine sans l'avoir nommé : son nom viendra de ses notes.
  const [newFrets, setNewFrets] = useState<Frets | null>(null)
  const drawingFrets =
    drawing && chords.includes(drawing)
      ? (draft.shapes[drawing] ?? chordShape(drawing)?.frets ?? Array<number | null>(6).fill(null))
      : null
  const addDrawn = (frets: Frets, name: string) => {
    onChange({ ...draft, chords: `${draft.chords.trim()} ${name}`.trim(), shapes: { ...draft.shapes, [name]: frets } })
    setNewFrets(null)
  }
  /** Renomme un accord partout dans la suite ; son diagramme le suit sous son nouveau nom. */
  const rename = (from: string, to: string, frets: Frets) => {
    setDrawing(null)
    if (to === from) return
    const { [from]: _removed, ...others } = draft.shapes
    onChange({
      ...draft,
      chords: chords.map((chord) => (chord === from ? to : chord)).join(' '),
      shapes: { ...others, [to]: frets },
    })
  }
  return (
    <form
      className="chord-editor"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <label htmlFor={`${id}-name`} className="silk">
        Nom
      </label>
      <input
        id={`${id}-name`}
        className="chord-input"
        value={draft.name}
        maxLength={MAX_NAME_LENGTH}
        placeholder="Balade du soir"
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
      />
      <label htmlFor={`${id}-chords`} className="silk">
        Accords
      </label>
      <input
        id={`${id}-chords`}
        className="chord-input chord-input-big"
        value={draft.chords}
        placeholder="Am F C G   ou   Lam Fa Do Sol"
        autoFocus
        onChange={(event) => onChange({ ...draft, chords: event.target.value })}
      />
      <button
        type="button"
        className="btn chord-draw"
        aria-pressed={newFrets !== null}
        onClick={() => {
          setDrawing(null)
          setNewFrets(newFrets ? null : Array<number | null>(6).fill(null))
        }}
      >
        <Icon name="chord" />
        Dessiner un accord sur la grille
      </button>
      {newFrets && (
        <FretEditor
          name={null}
          frets={newFrets}
          drawn={false}
          onChange={setNewFrets}
          onReset={() => undefined}
          onDone={(name) => addDrawn(newFrets, name)}
          onCancel={() => setNewFrets(null)}
        />
      )}
      <div className="chord-row">
        {chords.map((chord, index) => (
          <button
            key={index}
            type="button"
            className="chord-pick"
            aria-pressed={drawing === chord}
            aria-label={`Dessiner le diagramme de ${chord}`}
            onClick={() => {
              setNewFrets(null)
              setDrawing(drawing === chord ? null : chord)
            }}
          >
            <ChordDiagram name={chord} frets={draft.shapes[chord]} />
          </button>
        ))}
      </div>
      {chords.length > 0 && !drawingFrets && !newFrets && (
        <p className="fret-editor-help">Touchez un diagramme pour le dessiner vous-même.</p>
      )}
      {drawing && drawingFrets && (
        <FretEditor
          key={drawing}
          name={drawing}
          frets={drawingFrets}
          drawn={drawing in draft.shapes}
          onChange={(frets) => onChange({ ...draft, shapes: { ...draft.shapes, [drawing]: frets } })}
          onReset={() => {
            const { [drawing]: _removed, ...others } = draft.shapes
            onChange({ ...draft, shapes: others })
          }}
          onDone={(name) => rename(drawing, name, drawingFrets)}
          onCancel={() => setDrawing(null)}
        />
      )}
      <span className="silk">Rythmique</span>
      {draft.rhythm ? (
        <RhythmEditor rhythm={draft.rhythm} onChange={(rhythm) => onChange({ ...draft, rhythm })} />
      ) : (
        <button type="button" className="btn rhythm-add" onClick={() => onChange({ ...draft, rhythm: DEFAULT_RHYTHM })}>
          <Icon name="plus" />
          Ajouter une rythmique (facultatif)
        </button>
      )}
      <div className="chord-fields">
        <div>
          <label htmlFor={`${id}-bpm`} className="silk">
            Tempo (BPM)
          </label>
          <input
            id={`${id}-bpm`}
            className="chord-input"
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={draft.bpm}
            placeholder="Facultatif"
            onChange={(event) => onChange({ ...draft, bpm: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${id}-notes`} className="silk">
            Note
          </label>
          <textarea
            id={`${id}-notes`}
            className="chord-input"
            rows={2}
            value={draft.notes}
            maxLength={MAX_PROGRESSION_NOTES}
            placeholder="Capodastre, d'où vient la suite…"
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          />
        </div>
      </div>
      <div className="chord-actions" aria-busy={busy !== null}>
        <button
          type="submit"
          className="btn btn-solid"
          disabled={chords.length === 0 || busy !== null}
          data-working={busy === 'save' || undefined}
        >
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
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy !== null}
                data-working={busy === 'delete' || undefined}
                onClick={onDelete}
              >
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

/** Le carnet d'accords en fenêtre : les suites qu'on a aimées, à garder et à rejouer plus tard. */
export function ChordBook({
  open,
  onClose,
  onPlay,
}: {
  open: boolean
  onClose: () => void
  /** Ouvre la suite en lecture, par-dessus le carnet. */
  onPlay: (progression: ChordProgression) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [list, setList] = useState<ChordProgression[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState(false)
  // L'écriture en cours : le formulaire l'affiche et se bloque, pour qu'on ne croie pas à une panne.
  const [busy, setBusy] = useState<Busy>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      element.focus()
      fetch('/api/chords')
        .then((response) => (response.ok ? (response.json() as Promise<ChordProgression[]>) : Promise.reject()))
        .then(setList, () => setError(true))
    }
    if (!open && element.open) element.close()
  }, [open])

  const isNew = draft !== null && !list?.some((p) => p.id === draft.id)

  const write = (id: string, progression: ChordProgression | null) => {
    setBusy(progression ? 'save' : 'delete')
    return save(id, progression)
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
    const bpm = Number(draft.bpm)
    const chords = splitChords(draft.chords)
    // Seuls les diagrammes des accords encore dans la suite sont gardés.
    const shapes = Object.fromEntries(Object.entries(draft.shapes).filter(([name]) => chords.includes(name)))
    const progression: ChordProgression = {
      id: draft.id,
      name: draft.name.trim() || 'Sans titre',
      chords,
      notes: draft.notes,
      ...(Object.keys(shapes).length > 0 ? { shapes } : {}),
      ...(draft.rhythm ? { rhythm: draft.rhythm } : {}),
      ...(Number.isInteger(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM ? { bpm } : {}),
    }
    void write(draft.id, progression)
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet chords-sheet"
      aria-labelledby="chords-title"
      // Le brouillon survit à une fermeture par mégarde (Échap) : on le retrouve en rouvrant le carnet.
      onClose={onClose}
    >
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Outil</p>
            <h2 id="chords-title">Accords</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            <Icon name="close" />
            Fermer
          </button>
        </div>

        {error && (
          <p className="notice" role="alert">
            <b>Enregistrement impossible.</b> Le carnet n'a pas pu être lu ou modifié.
          </p>
        )}

        {draft ? (
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
            <button
              type="button"
              className="btn btn-solid"
              onClick={() =>
                setDraft({ id: crypto.randomUUID(), name: '', chords: '', bpm: '', notes: '', shapes: {}, rhythm: null })
              }
            >
              <Icon name="plus" />
              Nouvelle suite
            </button>
            {list?.length === 0 && (
              <p className="chord-empty">
                Notez ici les suites d'accords qui vous plaisent, pour les retrouver et les rejouer plus tard.
              </p>
            )}
            <ul className="chord-list">
              {list?.map((progression) => (
                <li key={progression.id}>
                  <div className="chord-list-head">
                    <h3>{progression.name}</h3>
                    {progression.bpm && <span className="silk">{progression.bpm} BPM</span>}
                    <button type="button" className="btn chord-play" onClick={() => onPlay(progression)}>
                      <Icon name="play" />
                      Jouer
                    </button>
                    <button type="button" className="btn" onClick={() => setDraft(toDraft(progression))}>
                      Modifier
                    </button>
                  </div>
                  <div className="chord-row">
                    {progression.chords.map((chord, index) => (
                      <ChordDiagram key={index} name={chord} frets={progression.shapes?.[chord]} />
                    ))}
                  </div>
                  {progression.rhythm && <RhythmStrip rhythm={progression.rhythm} />}
                  {progression.notes && <p className="chord-notes">{progression.notes}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  )
}
