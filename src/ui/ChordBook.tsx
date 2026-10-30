import { useEffect, useId, useRef, useState } from 'react'
import { SHOWN_FRETS, capoForm, capoShape, detectChord, drawnShape, firstFret, fretsName, type Frets } from '../chords.ts'
import type { ChordProgression, Rhythm } from '../courseTypes.ts'
import { BEATS, MAX_BPM, MIN_BPM } from '../limits.ts'
import {
  DEFAULT_RHYTHM,
  MAX_CAPO,
  MAX_CHORDS,
  MAX_CHORD_BARS,
  MAX_CHORD_LENGTH,
  MAX_FRET,
  MAX_NAME_LENGTH,
  MAX_PROGRESSIONS,
  MAX_PROGRESSION_NOTES,
  SUBDIVISIONS,
  chordTokens,
  countLabel,
  isNoChord,
  isRepeatMark,
  isSameChord,
  moveChord,
  realignDurations,
  removeChord,
  renameChord,
  resizeRhythm,
  splitChords,
  variantName,
} from '../progressions.ts'
import { Icon } from './Icon.tsx'

/**
 * Diagramme d'un accord : six cordes verticales, le sillet (ou la case de départ), les doigts.
 * `frets` : la position dessinée à la main, sinon celle de la bibliothèque. `of` : l'accord à montrer
 * sous ce nom, quand ce n'est pas le nom lui-même (« % » montre l'accord qu'il reprend).
 * `capo` : le diagramme montre la forme à jouer, comptée depuis le capodastre, et la nomme sous l'accord.
 */
export function ChordDiagram({ name, frets, of = name, capo = 0 }: { name: string; frets?: Frets; of?: string; capo?: number }) {
  const shape = frets ? drawnShape(frets) : capoShape(of, capo)
  const form = frets ? null : capoForm(of, capo)
  const noChord = !shape && isNoChord(of)
  const first = shape ? firstFret(shape.frets) : 1
  // Quatre cases d'habitude ; plus pour un accord dessiné plus écarté, qui reste ainsi en entier.
  const shown = Math.max(SHOWN_FRETS, ...(shape?.frets ?? []).map((f) => (f ?? 0) - first + 1))
  const x = (string: number) => 10 + string * 12
  const y = (fret: number) => 18 + (fret - first + 0.5) * 16
  const label = shape
    ? `${name} : ${shape.frets.map((f) => (f === null ? 'x' : f)).join(' ')}`
    : `${name} : ${noChord ? "pas d'accord" : 'position inconnue'}`

  return (
    <figure className="chord">
      <figcaption>
        {name}
        {form && <small className="chord-form">forme {form}</small>}
      </figcaption>
      {/* Le numéro de case peut déborder à droite : « 10 » et au-delà ne tiennent pas dans la marge. */}
      <svg viewBox={`0 0 80 ${92 + (shown - SHOWN_FRETS) * 16}`} overflow="visible" role="img" aria-label={label}>
        {shape ? (
          <>
            {first === 1 ? (
              <rect x={x(0)} y={16} width={60} height={3} fill="currentColor" />
            ) : (
              <text x={x(5) + 6} y={y(first) + 4} className="chord-fret">
                {first}
              </text>
            )}
            {Array.from({ length: shown + 1 }, (_, i) => (
              <line key={`f${i}`} x1={x(0)} x2={x(5)} y1={18 + i * 16} y2={18 + i * 16} className="chord-line" />
            ))}
            {shape.frets.map((fret, string) => (
              <g key={string}>
                <line x1={x(string)} x2={x(string)} y1={18} y2={18 + shown * 16} className="chord-line" />
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
            {noChord ? '—' : '?'}
          </text>
        )}
      </svg>
    </figure>
  )
}

/** Un accord qu'on peut dessiner : ni « % », ni « N.C. », ni une marque de reprise. */
const isDrawable = (chord: string) => !isSameChord(chord) && !isNoChord(chord) && !isRepeatMark(chord)

/** L'élément `index` de la suite : son diagramme ; « % » montre l'accord qu'il reprend ; « x2 » n'est qu'une marque. */
function ChordCell({ chords, index, shapes, capo }: { chords: string[]; index: number; shapes: Record<string, Frets>; capo: number }) {
  const chord = chords[index]
  if (isRepeatMark(chord)) return <span className="chord-mark">{chord}</span>
  if (!isSameChord(chord)) return <ChordDiagram name={chord} frets={shapes[chord]} capo={capo} />
  const repeated = chords.slice(0, index).findLast((c) => !isSameChord(c) && !isRepeatMark(c)) ?? 'N.C.'
  return <ChordDiagram name={chord} of={repeated} frets={shapes[repeated]} capo={capo} />
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
  /** Case du capodastre ; 0 sans capo. */
  capo: number
  /** Mesures de chaque accord, à la même place ; un accord au-delà de la liste dure une mesure. */
  durations: number[]
}

const toDraft = (p: ChordProgression): Draft => ({
  id: p.id,
  name: p.name,
  chords: p.chords.join(' '),
  bpm: p.bpm ? String(p.bpm) : '',
  notes: p.notes,
  shapes: p.shapes ?? {},
  rhythm: p.rhythm ?? null,
  capo: p.capo ?? 0,
  durations: p.durations ?? [],
})

/** Une nouvelle suite, avant qu'on y touche. */
const BLANK_DRAFT: Omit<Draft, 'id'> = { name: '', chords: '', bpm: '', notes: '', shapes: {}, rhythm: null, capo: 0, durations: [] }

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
  capo,
  drawn,
  onChange,
  onReset,
  onDone,
  onCancel,
  resolveName,
}: {
  /** L'accord dont on redessine le diagramme ; null pour un nouvel accord, nommé d'après ses notes. */
  name: string | null
  frets: Frets
  capo: number
  drawn: boolean
  onChange: (frets: Frets) => void
  onReset: () => void
  /** Reçoit le nom retenu : celui qu'on a tapé, sinon l'accord reconnu. */
  onDone: (name: string) => void
  onCancel: () => void
  /** Le nom que l'accord prendra vraiment dans la suite (voir `variantName`). */
  resolveName: (name: string, frets: Frets) => string
}) {
  const id = useId()
  const [start, setStart] = useState(() => firstFret(frets))
  const rows = Array.from({ length: SHOWN_FRETS }, (_, i) => start + i)
  const set = (string: number, fret: number | null) => onChange(frets.with(string, fret))
  const detected = detectChord(frets, capo)
  const sounding = frets.some((f) => f !== null)
  // Tant qu'on ne l'a pas tapé, le nom d'un nouvel accord suit ce que la grille reconnaît.
  const [typed, setTyped] = useState<string | null>(name)
  const chosen = typed ?? (sounding ? (detected ?? fretsName(frets)) : '')
  const resolved = chosen === '' ? '' : resolveName(chosen, frets)

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
        {resolved !== chosen && (
          <p className="fret-editor-help">
            La suite a déjà {chosen} dans une autre position : celle-ci s'appellera <b>{resolved}</b>.
          </p>
        )}
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
  // La place de l'accord dont on redessine le diagramme ; changer l'ordre ou le texte de la suite ferme l'éditeur.
  const [drawing, setDrawing] = useState<number | null>(null)
  const drawingName = drawing === null ? undefined : chords[drawing]
  // Le nouvel accord qu'on dessine sans l'avoir nommé : son nom viendra de ses notes.
  const [newFrets, setNewFrets] = useState<Frets | null>(null)
  // Le glisser-déposer : l'accord qu'on tient et celui qu'on survole.
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  // L'accord touché : ses réglages s'affichent, une seule fois, sous la rangée des diagrammes.
  const [selected, setSelected] = useState<number | null>(null)
  const selectedName = selected === null ? undefined : chords[selected]
  const form = useRef<HTMLFormElement>(null)
  // Au clavier, le focus ne se perd pas : une flèche désactivée au bout de la suite passe la main à l'autre, un accord retiré à son voisin.
  const refocus = useRef<string | null>(null)
  useEffect(() => {
    if (!refocus.current) return
    form.current?.querySelector<HTMLElement>(refocus.current)?.focus()
    refocus.current = null
  })
  const durations = chords.map((_, index) => draft.durations[index] ?? 1)
  const move = (from: number, to: number) => {
    setDrawing(null)
    setSelected(selected === from ? to : null)
    onChange({ ...draft, chords: moveChord(draft.chords, from, to), durations: durations.toSpliced(from, 1).toSpliced(to, 0, durations[from]) })
  }
  const drawingFrets =
    drawingName !== undefined
      ? (draft.shapes[drawingName] ?? capoShape(drawingName, draft.capo)?.frets ?? Array<number | null>(6).fill(null))
      : null
  const addDrawn = (frets: Frets, chosen: string) => {
    const name = variantName(chosen, frets, chords, draft.shapes, draft.capo)
    onChange({ ...draft, chords: `${draft.chords.trim()} ${name}`.trim(), shapes: { ...draft.shapes, [name]: frets } })
    setNewFrets(null)
  }
  /** Les diagrammes dessinés, sans celui de `chord` s'il ne sert qu'à l'accord `at`. */
  const shapesWithout = (at: number) => {
    const { [chords[at]]: _alone, ...others } = draft.shapes
    return chords.toSpliced(at, 1).includes(chords[at]) ? draft.shapes : others
  }
  /** Le nom que prendra l'accord `at` renommé en `to` : son diagramme dessiné ne doit écraser aucun autre. */
  const renamed = (at: number, to: string) => {
    const drawn = draft.shapes[chords[at]]
    return drawn ? variantName(to, drawn, chords.toSpliced(at, 1), shapesWithout(at), draft.capo) : to
  }
  /**
   * Renomme un accord, lui seul : ses doublons dans la suite ne bougent pas. Un diagramme dessiné à la main
   * le suit ; la position automatique, elle, est celle du nouveau nom (corriger « Amm » en « Am » donne le diagramme de Am).
   */
  const rename = (at: number, to: string) => {
    setDrawing(null)
    const target = renamed(at, to)
    if (target === chords[at]) return
    const drawn = draft.shapes[chords[at]]
    const others = shapesWithout(at)
    onChange({
      ...draft,
      chords: renameChord(draft.chords, at, target),
      shapes: drawn ? { ...others, [target]: drawn } : others,
    })
  }
  /**
   * Redessine un accord, lui seul : s'il a des doublons, il prend un nom à lui (« C(2) »), car chaque nom
   * n'a qu'un diagramme ; les autres gardent le leur.
   */
  const redraw = (at: number, frets: Frets) => {
    const chord = chords[at]
    if (!chords.toSpliced(at, 1).includes(chord)) {
      onChange({ ...draft, shapes: { ...draft.shapes, [chord]: frets } })
      return
    }
    const target = variantName(chord.replace(/\(\d+\)$/, ''), frets, chords, draft.shapes, draft.capo)
    if (target === chord) return
    onChange({ ...draft, chords: renameChord(draft.chords, at, target), shapes: { ...draft.shapes, [target]: frets } })
  }
  // Ce qui sera perdu à l'enregistrement : on prévient plutôt que de couper sans rien dire.
  const tokens = chordTokens(draft.chords)
  const dropped = tokens.length - MAX_CHORDS
  const tooLong = tokens.slice(0, MAX_CHORDS).some((chord) => chord.length > MAX_CHORD_LENGTH)
  return (
    <form
      ref={form}
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
      <div className="chord-entry">
        <input
          id={`${id}-chords`}
          className="chord-input chord-input-big"
          value={draft.chords}
          placeholder="Am F C G   ou   Lam Fa Do Sol"
          autoFocus
          onChange={(event) => {
            setDrawing(null)
            setSelected(null)
            onChange({
              ...draft,
              chords: event.target.value,
              durations: realignDurations(chords, splitChords(event.target.value), durations),
            })
          }}
        />
        <button
          type="button"
          className="btn"
          aria-pressed={newFrets !== null}
          onClick={() => {
            setDrawing(null)
            setSelected(null)
            setNewFrets(newFrets ? null : Array<number | null>(6).fill(null))
          }}
        >
          <Icon name="chord" />
          Dessiner un accord sur la grille
        </button>
      </div>
      {(dropped > 0 || tooLong) && (
        <p className="chord-warning" role="status">
          {dropped > 0 &&
            `${MAX_CHORDS} accords au plus : ${dropped === 1 ? 'le dernier ne sera pas gardé' : `les ${dropped} derniers ne seront pas gardés`}. `}
          {tooLong && `Un nom d'accord dépasse ${MAX_CHORD_LENGTH} caractères : il sera coupé.`}
        </p>
      )}
      <div className="chord-capo" role="group" aria-label="Capodastre">
        <span className="silk">Capodastre</span>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Descendre le capodastre"
          disabled={draft.capo === 0}
          onClick={() => onChange({ ...draft, capo: draft.capo - 1 })}
        >
          −
        </button>
        <b aria-live="polite">{draft.capo === 0 ? 'Sans' : `Case ${draft.capo}`}</b>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Monter le capodastre"
          disabled={draft.capo >= MAX_CAPO}
          onClick={() => onChange({ ...draft, capo: draft.capo + 1 })}
        >
          +
        </button>
      </div>
      {draft.capo > 0 && (
        <p className="fret-editor-help">
          Écrivez les accords que vous voulez entendre : les diagrammes montrent la forme à jouer, le capodastre faisant office de sillet.
        </p>
      )}
      {newFrets && (
        <FretEditor
          name={null}
          frets={newFrets}
          capo={draft.capo}
          drawn={false}
          onChange={setNewFrets}
          onReset={() => undefined}
          onDone={(name) => addDrawn(newFrets, name)}
          onCancel={() => setNewFrets(null)}
          resolveName={(name, frets) => variantName(name, frets, chords, draft.shapes, draft.capo)}
        />
      )}
      <div className="chord-row">
        {chords.map((chord, index) => (
          <div
            key={index}
            className="chord-slot"
            draggable
            data-dragged={dragged === index || undefined}
            data-drop={dragged !== null && over === index && dragged !== index ? (dragged < index ? 'after' : 'before') : undefined}
            onDragStart={(event) => {
              // Pas de setData : déposé dans le champ Accords, l'accord s'y écrirait une seconde fois.
              event.dataTransfer.effectAllowed = 'move'
              setDragged(index)
            }}
            onDragOver={(event) => {
              if (dragged === null) return
              event.preventDefault()
              setOver(index)
            }}
            onDrop={(event) => {
              if (dragged === null) return
              event.preventDefault()
              if (dragged !== index) move(dragged, index)
            }}
            onDragEnd={() => {
              setDragged(null)
              setOver(null)
            }}
          >
            <button
              type="button"
              className="chord-pick"
              data-pick={index}
              aria-pressed={selected === index}
              aria-label={`Régler ${chord} (position ${index + 1} sur ${chords.length})`}
              onClick={() => {
                setNewFrets(null)
                setDrawing(null)
                setSelected(selected === index ? null : index)
              }}
            >
              <ChordCell chords={chords} index={index} shapes={draft.shapes} capo={draft.capo} />
            </button>
            {durations[index] > 1 && !isRepeatMark(chord) && <span className="chord-length">{durations[index]} mesures</span>}
          </div>
        ))}
      </div>
      {selected !== null && selectedName !== undefined ? (
        <div className="chord-tools" role="group" aria-label={`Réglages de ${selectedName}`}>
          <b>{selectedName}</b>
          {chords.length > 1 && (
            <div>
              <span className="silk">Place</span>
              {[-1, 1].map((step) => (
                <button
                  key={step}
                  type="button"
                  className="btn btn-icon"
                  data-step={step}
                  aria-label={step < 0 ? 'Déplacer vers la gauche' : 'Déplacer vers la droite'}
                  disabled={!chords[selected + step]}
                  onClick={() => {
                    if (!chords[selected + step * 2]) refocus.current = '[data-step]:not(:disabled)'
                    move(selected, selected + step)
                  }}
                >
                  <Icon name={step < 0 ? 'chevronLeft' : 'chevronRight'} />
                </button>
              ))}
            </div>
          )}
          {!isRepeatMark(selectedName) && (
            <div>
              <span className="silk">Durée</span>
              <button
                type="button"
                className="btn btn-icon"
                aria-label="Une mesure de moins"
                disabled={durations[selected] <= 1}
                onClick={() => onChange({ ...draft, durations: durations.with(selected, durations[selected] - 1) })}
              >
                −
              </button>
              <span className="chord-tools-value" aria-live="polite">
                {durations[selected]} mesure{durations[selected] > 1 && 's'}
              </span>
              <button
                type="button"
                className="btn btn-icon"
                aria-label="Une mesure de plus"
                disabled={durations[selected] >= MAX_CHORD_BARS}
                onClick={() => onChange({ ...draft, durations: durations.with(selected, durations[selected] + 1) })}
              >
                +
              </button>
            </div>
          )}
          <div className="chord-tools-end">
            {isDrawable(selectedName) && (
              <button type="button" className="btn" aria-pressed={drawing === selected} onClick={() => setDrawing(drawing === selected ? null : selected)}>
                <Icon name="chord" />
                Dessiner
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                refocus.current = `[data-pick="${Math.min(selected, chords.length - 2)}"]`
                setDrawing(null)
                setSelected(null)
                onChange({ ...draft, chords: removeChord(draft.chords, selected), durations: durations.toSpliced(selected, 1) })
              }}
            >
              <Icon name="close" />
              Retirer
            </button>
          </div>
        </div>
      ) : (
        chords.length > 0 &&
        !newFrets && <p className="fret-editor-help">Touchez un accord pour le déplacer, régler sa durée, le dessiner ou le retirer. Vous pouvez aussi le glisser à sa place.</p>
      )}
      {drawing !== null && drawingName !== undefined && drawingFrets && (
        <FretEditor
          key={drawing}
          name={drawingName}
          frets={drawingFrets}
          capo={draft.capo}
          drawn={drawingName in draft.shapes}
          onChange={(frets) => redraw(drawing, frets)}
          onReset={() => {
            const auto = capoShape(drawingName, draft.capo)?.frets
            // Le diagramme dessiné sert aussi à ses doublons : on ne l'efface que s'il n'est qu'à lui.
            if (auto && chords.toSpliced(drawing, 1).includes(drawingName)) redraw(drawing, auto)
            else onChange({ ...draft, shapes: shapesWithout(drawing) })
          }}
          onDone={(name) => rename(drawing, name)}
          onCancel={() => setDrawing(null)}
          resolveName={(name) => renamed(drawing, name)}
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
          <div className="chord-bpm">
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
            {draft.bpm !== '' && (
              <button type="button" className="btn btn-icon" aria-label="Retirer le tempo" onClick={() => onChange({ ...draft, bpm: '' })}>
                <Icon name="close" />
              </button>
            )}
          </div>
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
            placeholder="D'où vient la suite, conseils de jeu…"
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
  // On a demandé à fermer alors que la suite a des modifications : la fenêtre demande confirmation.
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      element.focus()
      fetch('/api/chords')
        .then((response) => (response.ok ? (response.json() as Promise<ChordProgression[]>) : Promise.reject()))
        .then(
          (saved) => {
            setList(saved)
            setError(false)
          },
          () => setError(true),
        )
    }
    if (!open) {
      // Fermer le carnet abandonne la suite en cours : on le rouvre toujours sur la liste.
      setDraft(null)
      setLeaving(false)
      if (element.open) element.close()
    }
  }, [open])

  const isNew = draft !== null && !list?.some((p) => p.id === draft.id)
  const full = (list?.length ?? 0) >= MAX_PROGRESSIONS
  const known = list?.find((p) => p.id === draft?.id)
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(known ? toDraft(known) : { id: draft.id, ...BLANK_DRAFT })

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
      ...(draft.capo > 0 ? { capo: draft.capo } : {}),
      ...(draft.durations.slice(0, chords.length).some((d) => d > 1) ? { durations: chords.map((_, index) => draft.durations[index] ?? 1) } : {}),
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
      data-leaving={leaving || undefined}
      // Échap : avec des modifications, il demande confirmation ; une seconde fois, il revient à la suite.
      // Sur la touche et pas seulement sur `cancel` : le navigateur ne laisse annuler `cancel` qu'une fois de suite.
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
              <h2 id="chords-title">Accords</h2>
            </div>
            <button type="button" className="btn" onClick={() => (dirty ? setLeaving(true) : onClose())}>
              <Icon name="close" />
              Fermer
            </button>
          </div>
        )}

        {error && (
          <p className="notice" role="alert">
            <b>Enregistrement impossible.</b> Le carnet n'a pas pu être lu ou modifié.
          </p>
        )}

        {/* Confirmation sur place, comme pour la suppression. */}
        {leaving ? (
          <div className="chord-leave" role="alert">
            <h2 id="chords-title">Fermer sans enregistrer ?</h2>
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
            <button
              type="button"
              className="btn btn-solid"
              disabled={full}
              onClick={() => setDraft({ id: crypto.randomUUID(), ...BLANK_DRAFT })}
            >
              <Icon name="plus" />
              Nouvelle suite
            </button>
            {full && (
              <p className="chord-empty">
                Le carnet est plein : {MAX_PROGRESSIONS} suites au plus. Supprimez-en une pour en noter une autre.
              </p>
            )}
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
                    {progression.capo && <span className="silk">Capo {progression.capo}</span>}
                    <button type="button" className="btn chord-play" onClick={() => onPlay(progression)}>
                      <Icon name="play" />
                      Jouer
                    </button>
                    <button type="button" className="btn" onClick={() => setDraft(toDraft(progression))}>
                      Modifier
                    </button>
                  </div>
                  <div className="chord-row">
                    {progression.chords.map((_, index) => (
                      <div key={index} className="chord-listed">
                        <ChordCell chords={progression.chords} index={index} shapes={progression.shapes ?? {}} capo={progression.capo ?? 0} />
                        {(progression.durations?.[index] ?? 1) > 1 && <span className="silk">{progression.durations?.[index]} mesures</span>}
                      </div>
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
