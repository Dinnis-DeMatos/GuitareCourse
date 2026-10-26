import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { BEATS, MAX_BPM, MIN_BPM, clampBpm, startMetronome, tapTempo } from '../metronome.ts'
import { isTypingTarget } from '../shortcuts.ts'
import { readSetting, writeSetting } from '../usePersistentState.ts'
import { Icon } from './Icon.tsx'
import { SectionHead } from './SectionHead.tsx'

const isBpm = (value: unknown): value is number => typeof value === 'number' && value === clampBpm(value)
const isBeats = (value: unknown): value is number => BEATS.some((beats) => beats === value)
const isRatio = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1

const KEYS = {
  bpm: 'guitarecourse.metronome-bpm',
  beats: 'guitarecourse.metronome-beats',
  volume: 'guitarecourse.metronome-volume',
} as const

interface MetronomeState {
  bpm: number
  beats: number
  /** De 0 à 1. */
  volume: number
  playing: boolean
  /** Temps que l'on entend (0 = premier de la mesure) ; null à l'arrêt. */
  beat: number | null
}

/*
 * Un seul métronome pour toute l'application : le pupitre et la fenêtre « Métronome » en sont deux vues.
 * Il continue de battre d'une leçon à l'autre, jusqu'à ce qu'on l'arrête ou qu'on ferme sa fenêtre.
 */
let state: MetronomeState = {
  bpm: readSetting(KEYS.bpm, 80, isBpm),
  beats: readSetting(KEYS.beats, 4, isBeats),
  volume: readSetting(KEYS.volume, 0.8, isRatio),
  playing: false,
  beat: null,
}
const listeners = new Set<() => void>()
let stopEngine: (() => void) | null = null

function update(patch: Partial<MetronomeState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

/** Réglage mémorisé : le moteur le relit à chaque temps, le changer ne le relance pas. */
function setSetting(key: 'bpm' | 'beats' | 'volume', value: number) {
  writeSetting(KEYS[key], value)
  update({ [key]: value })
}

function stop() {
  if (!stopEngine) return
  stopEngine()
  stopEngine = null
  update({ playing: false, beat: null })
}

function togglePlaying() {
  if (stopEngine) {
    stop()
  } else {
    stopEngine = startMetronome(
      () => state,
      (beat) => update({ beat }),
    )
    update({ playing: true })
  }
}

export function useMetronome(): MetronomeState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

/**
 * Le métronome : un tempo écrit comme sur une partition (« noire = 92 »), que l'on règle au curseur,
 * d'un cran ou en le tapant, et des temps qui s'allument tour à tour, le premier de chaque mesure accentué.
 * Le tempo se tape aussi au clavier, dans son champ. `titled` : avec son titre de section, pour le
 * pupitre ; la fenêtre porte le sien. `typeAnywhere` : un chiffre tapé n'importe où dans la fenêtre
 * ouverte commence la saisie du tempo.
 */
export function Metronome({ titled = true, typeAnywhere = false }: { titled?: boolean; typeAnywhere?: boolean }) {
  const { bpm, beats, volume, playing, beat } = useMetronome()
  const taps = useRef<number[]>([])
  const field = useRef<HTMLInputElement>(null)
  // Tempo en cours de saisie ; null quand le champ affiche le tempo en vigueur.
  const [draft, setDraft] = useState<string | null>(null)
  // Échap : le champ est quitté sans retenir la saisie.
  const cancelled = useRef(false)

  useEffect(() => {
    if (!typeAnywhere) return
    const onKeyDown = (event: KeyboardEvent) => {
      const input = field.current
      if (!input?.closest('dialog')?.open || !/^\d$/.test(event.key) || isTypingTarget(event.target)) return
      event.preventDefault()
      setDraft(event.key)
      input.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [typeAnywhere])

  function commitDraft() {
    if (draft && !cancelled.current) setSetting('bpm', clampBpm(Number(draft)))
    cancelled.current = false
    setDraft(null)
  }

  function tap() {
    taps.current = [...taps.current.slice(-4), performance.now()]
    const tapped = tapTempo(taps.current)
    if (tapped !== null) setSetting('bpm', tapped)
  }

  const level = Math.round(volume * 100)
  const position = ((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100

  return (
    <section
      className="metronome"
      aria-label={titled ? undefined : 'Métronome'}
      aria-labelledby={titled ? 'metronome-title' : undefined}
    >
      {titled && <SectionHead id="metronome-title" title="Métronome" />}

      <div className="metro-head">
        <button
          type="button"
          className="foot"
          onClick={togglePlaying}
          aria-label={playing ? 'Arrêter le métronome' : 'Lancer le métronome'}
        >
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <p className="metro-tempo">
          <Icon name="note" />
          <span aria-hidden="true">=</span>
          <input
            ref={field}
            className="metro-bpm"
            inputMode="numeric"
            maxLength={3}
            value={draft ?? String(bpm)}
            aria-label={`Tempo en battements par minute, de ${MIN_BPM} à ${MAX_BPM}`}
            title="Cliquez et tapez un tempo, puis Entrée"
            onFocus={(event) => event.target.select()}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                // Annule la saisie sans fermer la fenêtre du métronome.
                event.preventDefault()
                cancelled.current = true
                event.currentTarget.blur()
              }
            }}
          />
          <em>bpm</em>
        </p>
        <div className="keys">
          <button
            type="button"
            className="sw sw-icon"
            onClick={() => setSetting('bpm', clampBpm(bpm - 1))}
            aria-label="Ralentir d'un battement par minute"
          >
            −
          </button>
          <button
            type="button"
            className="sw sw-icon"
            onClick={() => setSetting('bpm', clampBpm(bpm + 1))}
            aria-label="Accélérer d'un battement par minute"
          >
            +
          </button>
          <button type="button" className="sw" onClick={tap} title="Tapez au moins deux fois en rythme">
            Taper
          </button>
        </div>
      </div>

      <input
        type="range"
        className="fader metro-fader"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        aria-label="Tempo"
        style={{ '--v': `${position}%` } as CSSProperties}
        onChange={(event) => setSetting('bpm', Number(event.target.value))}
      />

      <div className="metro-beats" aria-hidden="true">
        {Array.from({ length: beats }, (_, index) => (
          <i key={index} data-accent={index === 0 ? 'true' : undefined} data-on={beat === index ? 'true' : undefined} />
        ))}
      </div>

      <div className="metro-foot">
        <div className="knob" role="group" aria-label="Temps par mesure">
          <span className="silk">Temps par mesure</span>
          <div className="keys">
            {BEATS.map((value) => (
              <button
                key={value}
                type="button"
                className="sw"
                aria-pressed={beats === value}
                onClick={() => setSetting('beats', value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <label className="knob">
          <span className="silk">Volume</span>
          <input
            type="range"
            className="fader"
            min={0}
            max={100}
            value={level}
            aria-label="Volume du métronome"
            style={{ '--v': `${level}%` } as CSSProperties}
            onChange={(event) => setSetting('volume', Number(event.target.value) / 100)}
          />
        </label>
      </div>
    </section>
  )
}

/**
 * Le métronome en fenêtre, ouvert depuis les outils de l'index, comme l'exercice du manche. La fermer
 * (bouton ou Échap) arrête le métronome ; un clic à côté ne la ferme pas.
 */
export function MetronomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      element.focus()
    }
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet metronome-sheet"
      aria-labelledby="metronome-sheet-title"
      onClose={() => {
        stop()
        onClose()
      }}
    >
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Outil</p>
            <h2 id="metronome-sheet-title">Métronome</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            <Icon name="close" />
            Fermer
          </button>
        </div>
        <Metronome titled={false} typeAnywhere />
      </div>
    </dialog>
  )
}
