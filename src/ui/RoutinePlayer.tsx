import { useEffect, useRef, useState } from 'react'
import { isTypingTarget } from '../shortcuts.ts'
import { formatClock, formatMinutes, stepInfo, type Routine } from '../routines.ts'
import { createStopwatch } from '../stopwatch.ts'
import { Icon } from './Icon.tsx'
import { onMetronomeBeat, restartMetronome, stopMetronome, useMetronome } from './Metronome.tsx'

/** Deux notes montantes (La, Mi) : la fin d'un exercice, qu'on entend par-dessus la guitare. */
function chime(volume: number) {
  if (volume <= 0) return
  const context = new AudioContext()
  ;[880, 1318.5].forEach((frequency, i) => {
    const at = context.currentTime + i * 0.18
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.4 * volume, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.6)
  })
  setTimeout(() => void context.close(), 1200)
}

/** Décompte avant l'exercice, exercice en cours, pause, routine finie. */
type Phase = 'count' | 'run' | 'pause' | 'done'

/**
 * Une routine en cours, en fenêtre comme les autres outils : l'exercice et son compte à rebours en grand,
 * lisibles de loin, la guitare dans les mains. À la fin d'un exercice, un carillon et on passe au suivant, après un décompte.
 */
export function RoutinePlayer({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const { volume, beats, beat, playing } = useMetronome()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])
  const metronome = useRef({ volume, beats })
  metronome.current = { volume, beats }
  // Le chronomètre de l'exercice ne part qu'à la fin du décompte.
  const [stopwatch] = useState(() => createStopwatch())
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('count')
  // Le temps du décompte qu'on vient d'entendre (1, 2, 3, 4), ou les secondes qui restent sans tempo (3, 2, 1).
  const [count, setCount] = useState<number | null>(null)
  const [, tick] = useState(0)
  // Change à chaque départ demandé : rejouer le même exercice relance son décompte.
  const [take, setTake] = useState(0)
  const steps = routine.steps
  const step = steps[index]
  const length = step.minutes * 60_000

  // Décompte : une mesure de métronome au tempo de l'exercice, et l'exercice part sur le premier temps
  // suivant ; sans tempo, trois secondes. À chaque exercice, et à chaque reprise après une pause.
  useEffect(() => {
    if (phase !== 'count') return
    setCount(null)
    const go = () => {
      stopwatch.start()
      setPhase('run')
    }
    if (step.bpm) {
      const total = metronome.current.beats
      let heard = 0
      const off = onMetronomeBeat(() => {
        heard++
        if (heard <= total) return setCount(heard)
        off()
        go()
      })
      restartMetronome(step.bpm)
      return off
    }
    stopMetronome()
    let left = 3
    setCount(left)
    const timer = setInterval(() => {
      left--
      if (left > 0) return setCount(left)
      clearInterval(timer)
      go()
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, index, take, step.bpm, stopwatch])

  // Pendant l'exercice, le métronome continue sur sa lancée ; il se tait en pause et à la fin.
  useEffect(() => {
    if (phase === 'pause' || phase === 'done') stopMetronome()
  }, [phase])
  useEffect(() => stopMetronome, [])

  useEffect(() => {
    if (phase !== 'run') return
    const timer = setInterval(() => {
      if (stopwatch.read() < length) return tick((n) => n + 1)
      chime(metronome.current.volume)
      stopwatch.reset(false)
      if (index === steps.length - 1) {
        stopwatch.stop()
        setPhase('done')
        // Pour le parcours de l'accueil ; un échec n'empêche pas de finir la séance.
        void fetch('/api/routine-runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: routine.name, minutes: steps.reduce((sum, s) => sum + s.minutes, 0) }),
        }).catch(() => {})
      } else {
        setIndex(index + 1)
        setPhase('count')
      }
    }, 250)
    return () => clearInterval(timer)
  }, [phase, index, length, steps, routine.name, stopwatch])

  const toggle = () => {
    if (phase === 'pause') return setPhase('count')
    stopwatch.stop()
    setPhase('pause')
  }
  /** Un autre exercice : il repart de zéro, après un décompte (sauf en pause, où on attend la reprise). */
  const go = (target: number) => {
    stopwatch.reset(false)
    setIndex(target)
    setTake((n) => n + 1)
    if (phase !== 'pause') setPhase('count')
  }
  const restart = () => {
    stopwatch.reset(false)
    setIndex(0)
    setPhase('count')
  }
  const done = phase === 'done'
  const counting = phase === 'count'

  const elapsed = Math.min(stopwatch.read(), length)
  const left = steps.slice(index + 1).reduce((sum, s) => sum + s.minutes, 0) * 60_000 + length - elapsed
  const next = steps[index + 1]
  const total = steps.reduce((sum, s) => sum + s.minutes, 0)

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet player routine-sheet"
      aria-labelledby="routine-player-title"
      data-paused={phase === 'pause' || undefined}
      onClose={onClose}
      onKeyDown={(event) => {
        // Espace : pause ou reprise, même quand un bouton a le focus.
        if (event.key !== ' ' || done || isTypingTarget(event.target)) return
        event.preventDefault()
        if (!event.repeat) toggle()
      }}
    >
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Routine · {formatMinutes(total)}</p>
            <h2 id="routine-player-title">{routine.name}</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            <Icon name="close" />
            Fermer
          </button>
        </div>

        {done ? (
          <div className="routine-done" role="status">
            <p className="player-name">Routine terminée</p>
            <p className="routine-player-info">{formatMinutes(total)} d'entraînement. Bravo !</p>
            <div className="player-controls">
              <button type="button" className="btn" onClick={restart}>
                Recommencer
              </button>
              <button type="button" className="btn btn-solid" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="player-stage" data-counting={counting || undefined}>
              <div className="player-now">
                <p className="silk">
                  {counting ? 'Décompte' : phase === 'pause' ? 'En pause' : 'En cours'} · exercice {index + 1} / {steps.length}
                </p>
                <p className="player-name" aria-live="polite">
                  {step.name || 'Sans titre'}
                </p>
                {(step.bpm || step.details) && <p className="routine-player-info">{stepInfo(step)}</p>}
              </div>
              {next && (
                <div className="player-next">
                  <p className="silk">Ensuite · {next.minutes} min</p>
                  <p className="player-name">{next.name || 'Sans titre'}</p>
                  {(next.bpm || next.details) && <p className="routine-player-info">{stepInfo(next)}</p>}
                </div>
              )}
            </div>

            {counting ? (
              <p className="routine-clock" aria-live="assertive" aria-label="Décompte avant le départ">
                {count ?? '…'}
              </p>
            ) : (
              <p className="routine-clock" role="timer" aria-label="Temps restant pour cet exercice">
                {formatClock(length - elapsed)}
              </p>
            )}
            <div className="routine-bar" aria-hidden="true">
              <span style={{ width: `${(elapsed / length) * 100}%` }} />
            </div>
            {step.bpm && (
              <div className="metro-beats" aria-hidden="true">
                {Array.from({ length: beats }, (_, b) => (
                  <i key={b} data-accent={b === 0 ? 'true' : undefined} data-on={playing && beat === b ? 'true' : undefined} />
                ))}
              </div>
            )}

            <ol className="player-sequence" aria-label="Exercices de la routine">
              {steps.map((s, i) => (
                <li key={i}>
                  <button type="button" aria-current={i === index ? 'step' : undefined} onClick={() => go(i)}>
                    {s.name || 'Sans titre'} · {s.minutes} min
                  </button>
                </li>
              ))}
            </ol>

            <div className="player-controls">
              <button type="button" className="btn btn-icon" disabled={index === 0} aria-label="Exercice précédent" onClick={() => go(index - 1)}>
                <Icon name="chevronLeft" />
              </button>
              <button type="button" className="player-play" aria-label={phase === 'pause' ? 'Reprendre' : 'Pause'} onClick={toggle}>
                <Icon name={phase === 'pause' ? 'play' : 'pause'} />
              </button>
              <button
                type="button"
                className="btn btn-icon"
                disabled={index === steps.length - 1}
                aria-label="Exercice suivant"
                onClick={() => go(index + 1)}
              >
                <Icon name="chevronRight" />
              </button>
              <button type="button" className="btn" onClick={() => go(index)}>
                <Icon name="repeatStart" />
                Revenir au début de l'exercice
              </button>
              <span className="routine-player-info">Reste {formatClock(left)} en tout</span>
            </div>
            <p className="fret-editor-help">Espace : pause ou reprise, avec un décompte avant de repartir.</p>
          </>
        )}
      </div>
    </dialog>
  )
}
