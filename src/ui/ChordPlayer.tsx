import { useEffect, useRef, useState } from 'react'
import type { ChordProgression } from '../courseTypes.ts'
import { MAX_BPM, MIN_BPM, clampBpm, startMetronome } from '../metronome.ts'
import { ChordDiagram, RhythmStrip } from './ChordBook.tsx'
import { Icon } from './Icon.tsx'
import { useMetronome } from './Metronome.tsx'

/** Combien de mesures on reste sur chaque accord. */
const BARS = [1, 2, 4] as const

/**
 * Où en est la lecture : la mesure jouée, le temps entendu, et le décompte d'une mesure qui précède
 * chaque départ (« pending » : pas encore commencé).
 */
interface Position {
  measure: number
  beat: number | null
  counting: 'pending' | boolean
}

/**
 * Jouer une suite d'accords : l'accord en cours en grand, le suivant à côté, qui avancent au tempo de la
 * suite, au clic du métronome, après une mesure de décompte. La rythmique, s'il y en a une, s'allume
 * temps par temps.
 */
export function ChordPlayer({ progression, onClose }: { progression: ChordProgression | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const metronome = useMetronome()
  const [bpm, setBpm] = useState(80)
  const [bars, setBars] = useState<number>(1)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState<Position>({ measure: 0, beat: null, counting: false })
  const beats = progression?.rhythm?.beats ?? metronome.beats
  // Le moteur relit ces réglages à chaque temps : les changer pendant la lecture vaut dès le temps suivant.
  const settings = useRef({ bpm, beats, volume: metronome.volume })
  settings.current = { bpm, beats, volume: metronome.volume }

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (progression && !element.open) {
      setBpm(progression.bpm ?? metronome.bpm)
      setPosition({ measure: 0, beat: null, counting: false })
      setPlaying(false)
      element.showModal()
      element.focus()
    }
    if (!progression) {
      // Quelle que soit la façon de fermer (bouton, Échap), plus de suite : plus de clic.
      setPlaying(false)
      if (element.open) element.close()
    }
    // Seulement à l'ouverture : le tempo du métronome ne doit pas écraser celui qu'on règle ici.
  }, [progression])

  useEffect(() => {
    if (!playing) return
    return startMetronome(
      () => settings.current,
      (beat) =>
        setPosition((p) => {
          if (beat !== 0) return { ...p, beat }
          if (p.counting === 'pending') return { ...p, beat, counting: true }
          if (p.counting) return { ...p, beat, counting: false }
          return { measure: p.measure + 1, beat, counting: false }
        }),
    )
  }, [playing])

  if (!progression) return <dialog ref={dialog} className="sheet player" />

  const chords = progression.chords
  const index = Math.floor(position.measure / bars) % chords.length
  const current = chords[index]
  const next = chords[(index + 1) % chords.length]
  const counting = position.counting !== false

  const toggle = () => {
    if (!playing) {
      // On repart au début de l'accord en cours, après une mesure de décompte.
      setPosition((p) => ({ measure: Math.floor(p.measure / bars) * bars, beat: null, counting: 'pending' }))
    }
    setPlaying(!playing)
  }
  const jump = (target: number) => setPosition((p) => ({ ...p, measure: target * bars }))

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet player"
      aria-labelledby="player-title"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault()
          toggle()
        }
      }}
    >
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Jouer</p>
            <h2 id="player-title">{progression.name}</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            <Icon name="close" />
            Fermer
          </button>
        </div>

        <div className="player-stage" data-counting={counting || undefined}>
          <div className="player-now">
            <p className="silk">{counting ? `Décompte · ${(position.beat ?? 0) + 1}` : 'En cours'}</p>
            <p className="player-name" aria-live="polite">
              {current}
            </p>
            <ChordDiagram name={current} frets={progression.shapes?.[current]} />
          </div>
          {chords.length > 1 && (
            <div className="player-next">
              <p className="silk">Ensuite</p>
              <p className="player-name">{next}</p>
              <ChordDiagram name={next} frets={progression.shapes?.[next]} />
            </div>
          )}
        </div>

        <div className="metro-beats" aria-hidden="true">
          {Array.from({ length: beats }, (_, beat) => (
            <i
              key={beat}
              data-accent={beat === 0 ? 'true' : undefined}
              data-on={playing && position.beat === beat ? 'true' : undefined}
            />
          ))}
        </div>

        {progression.rhythm && (
          <RhythmStrip rhythm={progression.rhythm} activeBeat={playing && !counting ? position.beat : null} />
        )}

        <ol className="player-sequence" aria-label="Accords de la suite">
          {chords.map((chord, i) => (
            <li key={i}>
              <button type="button" aria-current={i === index ? 'step' : undefined} onClick={() => jump(i)}>
                {chord}
              </button>
            </li>
          ))}
        </ol>

        <div className="player-controls">
          <button
            type="button"
            className="player-play"
            onClick={toggle}
            aria-label={playing ? 'Mettre en pause' : 'Lancer (après une mesure de décompte)'}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <div className="player-tempo" role="group" aria-label="Tempo">
            <button
              type="button"
              className="btn btn-icon"
              aria-label="Ralentir"
              disabled={bpm <= MIN_BPM}
              onClick={() => setBpm(clampBpm(bpm - 5))}
            >
              −
            </button>
            <span className="player-bpm">
              {bpm} <span className="silk">BPM</span>
            </span>
            <button
              type="button"
              className="btn btn-icon"
              aria-label="Accélérer"
              disabled={bpm >= MAX_BPM}
              onClick={() => setBpm(clampBpm(bpm + 5))}
            >
              +
            </button>
          </div>
          <div className="player-bars" role="group" aria-label="Mesures par accord">
            <span className="silk">Mesures par accord</span>
            {BARS.map((value) => (
              <button
                key={value}
                type="button"
                className="btn btn-icon"
                aria-pressed={bars === value}
                onClick={() => {
                  // Garde l'accord en cours quand on change la durée de chaque accord.
                  setPosition((p) => ({ ...p, measure: index * value }))
                  setBars(value)
                }}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <p className="fret-editor-help">Espace : lancer ou mettre en pause. Le clic suit le volume du métronome.</p>
      </div>
    </dialog>
  )
}
