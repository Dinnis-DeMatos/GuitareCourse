import { useCallback, useEffect, useRef, useState } from 'react'
import { usePersistentState } from '../usePersistentState.ts'
import { detectPitch, FRETS, fretsOf, midiOf, NOTE_NAMES, pitchClassOf, randomTarget, STRINGS, type Target } from '../pitch.ts'

// Une note doit tenir quelques images d'affilée pour compter : on évite ainsi l'attaque et les parasites.
const STABLE_FRAMES = 5
// Temps laissé pour voir la bonne case avant la note suivante.
const REVEAL_MS = 1400

type Heard = { midi: number; correct: boolean } | null

/** Fenêtre de l'exercice du manche. Le micro n'est ouvert que tant qu'elle l'est. */
export function FretboardTrainer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="sheet trainer"
      aria-labelledby="trainer-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet-body">
        <p className="sheet-kicker">Exercice</p>
        <h2 id="trainer-title">Connaissance du manche</h2>
        {open && <Drill />}
        <button type="button" className="sheet-close" onClick={onClose}>
          Fermer
        </button>
      </div>
    </dialog>
  )
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function Drill() {
  const [sharps, setSharps] = usePersistentState('guitarecourse.trainer.sharps', false, isBoolean)
  const [target, setTarget] = useState<Target>(() => randomTarget(null, sharps))
  const [revealed, setRevealed] = useState(false)
  const [heard, setHeard] = useState<Heard>(null)
  const [score, setScore] = useState({ right: 0, tries: 0, streak: 0 })
  const [micError, setMicError] = useState<string | null>(null)

  // L'écoute tourne hors de React : elle lit la consigne en cours dans ces références.
  const targetRef = useRef(target)
  const revealedRef = useRef(revealed)
  useEffect(() => {
    targetRef.current = target
    revealedRef.current = revealed
  }, [target, revealed])

  const next = useCallback(() => {
    setTarget((previous) => randomTarget(previous, sharps))
    setRevealed(false)
    setHeard(null)
  }, [sharps])

  // Après une bonne réponse (ou « Voir la réponse »), on montre la case puis on passe à la suivante.
  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(next, REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [revealed, next])

  const judge = useCallback((midi: number) => {
    if (revealedRef.current) return
    const correct = pitchClassOf(midi) === targetRef.current.pitchClass
    setHeard({ midi, correct })
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), tries: s.tries + 1, streak: correct ? s.streak + 1 : 0 }))
    if (correct) setRevealed(true)
  }, [])

  useEffect(() => {
    let stream: MediaStream | undefined
    let context: AudioContext | undefined
    let frame = 0
    let cancelled = false

    navigator.mediaDevices
      // Les traitements prévus pour la voix déforment une guitare : on les coupe.
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop())
        stream = media
        context = new AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 2048
        context.createMediaStreamSource(media).connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        let candidate = -1
        let count = 0
        // Dernière note jugée : on ne la rejuge pas tant qu'elle sonne encore.
        let judged = -1

        const listen = () => {
          analyser.getFloatTimeDomainData(samples)
          const frequency = detectPitch(samples, context!.sampleRate)
          const midi = frequency ? midiOf(frequency) : -1
          count = midi === candidate ? count + 1 : 1
          candidate = midi
          if (count === STABLE_FRAMES) {
            if (midi === -1) judged = -1
            else if (midi !== judged) {
              judged = midi
              judge(midi)
            }
          }
          frame = requestAnimationFrame(listen)
        }
        listen()
      })
      .catch(() => {
        if (!cancelled) setMicError('Le micro est inaccessible : vérifiez qu’il est branché et autorisé pour l’application.')
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      void context?.close()
    }
  }, [judge])

  const string = STRINGS[target.string]

  return (
    <div className="drill">
      <p className="drill-prompt">
        Jouez <b>{NOTE_NAMES[target.pitchClass]}</b> sur la corde de <b>{string.name}</b>
      </p>

      <Fretboard target={target} revealed={revealed} />

      <p className="drill-heard" role="status" aria-live="polite" data-correct={heard ? String(heard.correct) : undefined}>
        {micError ??
          (heard
            ? `${heard.correct ? 'Juste' : 'Non'} : vous avez joué ${NOTE_NAMES[pitchClassOf(heard.midi)]}`
            : 'À l’écoute…')}
      </p>

      <div className="drill-bar">
        <span className="drill-score">
          <b>{score.right}</b>/{score.tries} justes · série <b>{score.streak}</b>
        </span>
        <label className="drill-option">
          <input
            type="checkbox"
            checked={sharps}
            onChange={(event) => {
              setSharps(event.target.checked)
              setTarget((previous) => randomTarget(previous, event.target.checked))
              setRevealed(false)
              setHeard(null)
            }}
          />
          Altérations (♯)
        </label>
        {revealed ? (
          <button type="button" className="btn" onClick={next}>
            Note suivante
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setRevealed(true)
              setHeard(null)
              setScore((s) => ({ ...s, tries: s.tries + 1, streak: 0 }))
            }}
          >
            Voir la réponse
          </button>
        )}
      </div>
    </div>
  )
}

const NUT = 24
const FRET_W = 52
const STRING_GAP = 20
const TOP = 16
const INLAYS = [3, 5, 7, 9]

/** Le manche en vue de tablature (Mi aigu en haut) ; la corde demandée est soulignée, la case montrée une fois trouvée. */
function Fretboard({ target, revealed }: { target: Target; revealed: boolean }) {
  const width = NUT + FRET_W * FRETS
  const bottom = TOP + STRING_GAP * (STRINGS.length - 1)
  const middle = (TOP + bottom) / 2
  const fretX = (fret: number) => (fret === 0 ? NUT / 2 : NUT + FRET_W * (fret - 0.5))

  return (
    <svg className="fretboard" viewBox={`0 0 ${width + 8} ${bottom + 34}`} role="img" aria-label={`Manche, corde de ${STRINGS[target.string].name}`}>
      {INLAYS.map((fret) => (
        <circle key={fret} className="fb-inlay" cx={fretX(fret)} cy={middle} r="5" />
      ))}
      <circle className="fb-inlay" cx={fretX(12)} cy={middle - STRING_GAP} r="5" />
      <circle className="fb-inlay" cx={fretX(12)} cy={middle + STRING_GAP} r="5" />
      <rect className="fb-nut" x={NUT - 4} y={TOP - 6} width="4" height={bottom - TOP + 12} />
      {Array.from({ length: FRETS }, (_, i) => (
        <line key={i} className="fb-fret" x1={NUT + FRET_W * (i + 1)} x2={NUT + FRET_W * (i + 1)} y1={TOP - 6} y2={bottom + 6} />
      ))}
      {Array.from({ length: FRETS + 1 }, (_, fret) => (
        <text key={fret} className="fb-number" x={fretX(fret)} y={bottom + 26}>
          {fret}
        </text>
      ))}
      {STRINGS.map((s, i) => (
        <line
          key={s.name}
          className="fb-string"
          data-target={i === target.string || undefined}
          x1={0}
          x2={width}
          y1={TOP + STRING_GAP * i}
          y2={TOP + STRING_GAP * i}
          strokeWidth={1 + i * 0.35}
        />
      ))}
      {revealed &&
        fretsOf(target).map((fret) => (
          <circle key={fret} className="fb-answer" cx={fretX(fret)} cy={TOP + STRING_GAP * target.string} r="8" />
        ))}
    </svg>
  )
}
