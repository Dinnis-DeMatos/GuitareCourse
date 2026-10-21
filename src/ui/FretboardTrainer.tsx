import { useCallback, useEffect, useRef, useState } from 'react'
import { usePersistentState } from '../usePersistentState.ts'
import { Icon } from './Icon.tsx'
import {
  createNoiseGate,
  detectPitch,
  FRETS,
  fretsOf,
  midiOf,
  NOTE_NAMES,
  noteKey,
  pitchClassOf,
  randomTarget,
  rmsOf,
  STRINGS,
  type NoteStatsMap,
  type Target,
} from '../pitch.ts'

// Une note doit tenir quelques images d'affilée pour compter : on évite ainsi l'attaque et les parasites.
const STABLE_FRAMES = 5
// Temps laissé pour voir la bonne case avant la note suivante.
const REVEAL_MS = 1400
/** Durée du défi, en secondes. */
const CHALLENGE_SECONDS = 60

type Heard = { midi: number; correct: boolean } | null
type Mode = 'free' | 'timed'

/** Mêmes données que server/trainer.ts. */
interface TrainerData {
  notes: NoteStatsMap
  sessions: { date: string; mode: Mode; right: number; tries: number }[]
}

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

function isMode(value: unknown): value is Mode {
  return value === 'free' || value === 'timed'
}

function isStrings(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every((i) => Number.isInteger(i) && i >= 0 && i < STRINGS.length)
  )
}

const ALL_STRINGS = STRINGS.map((_, i) => i)

/** Séance en cours, pas encore enregistrée. */
type Session = { right: number; tries: number; notes: NoteStatsMap }
const newSession = (): Session => ({ right: 0, tries: 0, notes: {} })

/** Ajoute une note au bilan : présentée une fois de plus, et ratée ou non. */
function addResult(notes: NoteStatsMap, key: string, miss: boolean): NoteStatsMap {
  const before = notes[key] ?? { tries: 0, misses: 0 }
  return { ...notes, [key]: { tries: before.tries + 1, misses: before.misses + (miss ? 1 : 0) } }
}

async function saveSession(mode: Mode, session: Session): Promise<TrainerData> {
  const response = await fetch('/api/trainer', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, ...session }),
    keepalive: true, // part même si la fenêtre se ferme
  })
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
  return response.json()
}

function Drill() {
  const [sharps, setSharps] = usePersistentState('guitarecourse.trainer.sharps', false, isBoolean)
  const [strings, setStrings] = usePersistentState('guitarecourse.trainer.strings', ALL_STRINGS, isStrings)
  const [mode, setMode] = usePersistentState<Mode>('guitarecourse.trainer.mode', 'free', isMode)
  // Séances enregistrées ; et bilan de chaque note, complété au fil de la séance (il guide le tirage).
  const [data, setData] = useState<TrainerData | null>(null)
  const [notes, setNotes] = useState<NoteStatsMap>({})
  const [saveError, setSaveError] = useState(false)
  const [target, setTarget] = useState<Target>(() => randomTarget(null, { sharps, strings }))
  const [revealed, setRevealed] = useState(false)
  const [heard, setHeard] = useState<Heard>(null)
  const [score, setScore] = useState({ right: 0, tries: 0, streak: 0 })
  const [micError, setMicError] = useState<string | null>(null)
  // Écoute coupée à la demande (on parle, la pièce est bruyante) : le micro est alors fermé.
  const [paused, setPaused] = useState(false)
  // Défi : prêt à lancer, en cours (jusqu'à `endsAt`), ou terminé.
  const [challenge, setChallenge] = useState({ phase: 'ready' as 'ready' | 'running' | 'done', endsAt: 0 })
  const [now, setNow] = useState(() => Date.now())

  const listening = mode === 'free' || challenge.phase === 'running'

  // L'écoute et les minuteries tournent hors de React : elles lisent l'état en cours dans ces références.
  const targetRef = useRef(target)
  const revealedRef = useRef(revealed)
  const listeningRef = useRef(listening)
  const notesRef = useRef(notes)
  const modeRef = useRef(mode)
  useEffect(() => {
    targetRef.current = target
    revealedRef.current = revealed
    listeningRef.current = listening
    notesRef.current = notes
    modeRef.current = mode
  }, [target, revealed, listening, notes, mode])

  const session = useRef(newSession())
  // Vrai dès qu'une mauvaise note a été jouée sur la consigne en cours.
  const missed = useRef(false)

  useEffect(() => {
    fetch('/api/trainer')
      .then((response) => (response.ok ? (response.json() as Promise<TrainerData>) : Promise.reject()))
      .then((saved) => {
        setData(saved)
        setNotes(saved.notes)
      })
      .catch(() => setSaveError(true))
  }, [])

  /** Enregistre la séance en cours (s'il y a eu au moins un essai) et en commence une nouvelle. */
  const flush = useCallback((sessionMode: Mode) => {
    const done = session.current
    session.current = newSession()
    if (done.tries === 0) return
    saveSession(sessionMode, done).then(
      (saved) => {
        setData(saved)
        setSaveError(false)
      },
      () => setSaveError(true),
    )
  }, [])

  // Fermer la fenêtre termine la séance libre ; un défi n'est enregistré qu'une fois mené à son terme.
  useEffect(
    () => () => {
      if (modeRef.current === 'free') flush('free')
    },
    [flush],
  )

  /** Bilan de la consigne qui se termine : trouvée du premier coup, ou ratée. */
  const finish = useCallback((done: Target, success: boolean) => {
    const key = noteKey(done)
    const miss = !success || missed.current
    session.current.tries++
    if (success) session.current.right++
    session.current.notes = addResult(session.current.notes, key, miss)
    setNotes((current) => addResult(current, key, miss))
  }, [])

  const next = useCallback(() => {
    missed.current = false
    setTarget((previous) => randomTarget(previous, { sharps, strings }, notesRef.current))
    setRevealed(false)
    setHeard(null)
  }, [sharps, strings])

  // Après une bonne réponse (ou « Voir la réponse »), on montre la case puis on passe à la suivante.
  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(next, REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [revealed, next])

  const judge = useCallback(
    (midi: number) => {
      if (revealedRef.current || !listeningRef.current) return
      const correct = pitchClassOf(midi) === targetRef.current.pitchClass
      setHeard({ midi, correct })
      setScore((s) => ({ right: s.right + (correct ? 1 : 0), tries: s.tries + 1, streak: correct ? s.streak + 1 : 0 }))
      if (correct) {
        finish(targetRef.current, true)
        setRevealed(true)
      } else {
        // Une mauvaise note compte comme un essai, mais la consigne reste.
        session.current.tries++
        missed.current = true
      }
    },
    [finish],
  )

  const reveal = () => {
    setRevealed(true)
    setHeard(null)
    setScore((s) => ({ ...s, tries: s.tries + 1, streak: 0 }))
    finish(target, false)
  }

  // Le compte à rebours du défi.
  useEffect(() => {
    if (challenge.phase !== 'running') return
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time < challenge.endsAt) return
      setChallenge((c) => ({ ...c, phase: 'done' }))
      flush('timed')
    }, 200)
    return () => window.clearInterval(timer)
  }, [challenge, flush])

  const startChallenge = () => {
    session.current = newSession()
    setScore({ right: 0, tries: 0, streak: 0 })
    next()
    setNow(Date.now())
    setChallenge({ phase: 'running', endsAt: Date.now() + CHALLENGE_SECONDS * 1000 })
  }

  const changeMode = (value: Mode) => {
    if (value === mode) return
    // La séance libre est enregistrée ; un défi interrompu ne compte pas.
    if (mode === 'free') flush('free')
    else session.current = newSession()
    setMode(value)
    setChallenge({ phase: 'ready', endsAt: 0 })
    setScore({ right: 0, tries: 0, streak: 0 })
    next()
  }

  /** Change les cordes ou les altérations : la consigne en cours est remplacée. */
  const changeOptions = (options: { sharps: boolean; strings: number[] }) => {
    setSharps(options.sharps)
    setStrings(options.strings)
    missed.current = false
    setTarget((previous) => randomTarget(previous, options, notes))
    setRevealed(false)
    setHeard(null)
  }

  useEffect(() => {
    if (paused) return
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
        const gate = createNoiseGate()

        const listen = () => {
          analyser.getFloatTimeDomainData(samples)
          const frequency = detectPitch(samples, context!.sampleRate, gate.threshold())
          gate.update(rmsOf(samples), frequency !== null)
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
  }, [judge, paused])

  const secondsLeft = Math.max(0, Math.ceil((challenge.endsAt - now) / 1000))
  const best = (data?.sessions ?? []).filter((s) => s.mode === 'timed').reduce((max, s) => Math.max(max, s.right), 0)
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

  return (
    <div className="drill">
      <div className="drill-options">
        <div className="drill-group" role="group" aria-label="Mode">
          <button type="button" className="btn" aria-pressed={mode === 'free'} onClick={() => changeMode('free')}>
            Libre
          </button>
          <button type="button" className="btn" aria-pressed={mode === 'timed'} onClick={() => changeMode('timed')}>
            Défi {CHALLENGE_SECONDS} s
          </button>
        </div>
        <div className="drill-group" role="group" aria-label="Cordes travaillées">
          {STRINGS.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className="btn"
              aria-pressed={strings.includes(i)}
              // Au moins une corde reste choisie.
              disabled={strings.length === 1 && strings.includes(i)}
              onClick={() =>
                changeOptions({
                  sharps,
                  strings: strings.includes(i) ? strings.filter((x) => x !== i) : [...strings, i].sort(),
                })
              }
            >
              {s.name}
            </button>
          ))}
        </div>
        <label className="drill-option">
          <input
            type="checkbox"
            checked={sharps}
            onChange={(event) => changeOptions({ sharps: event.target.checked, strings })}
          />
          Altérations (♯)
        </label>
      </div>

      {mode === 'timed' && challenge.phase !== 'running' ? (
        <div className="drill-challenge">
          <p className="drill-prompt">
            {challenge.phase === 'done' ? (
              <>
                <b>{plural(score.right, 'note')}</b> en {CHALLENGE_SECONDS} secondes
                {score.right > 0 && score.right >= best ? ' : nouveau record !' : ` · record : ${best}`}
              </>
            ) : (
              <>
                Trouvez un maximum de notes en {CHALLENGE_SECONDS} secondes.
                {best > 0 && <span className="drill-record"> Record : {best}</span>}
              </>
            )}
          </p>
          <button type="button" className="btn btn-solid" onClick={startChallenge}>
            {challenge.phase === 'done' ? 'Rejouer' : 'Lancer le défi'}
          </button>
        </div>
      ) : (
        <>
          <p className="drill-prompt">
            Jouez <b>{NOTE_NAMES[target.pitchClass]}</b> sur la corde de <b>{STRINGS[target.string].name}</b>
          </p>

          <Fretboard target={target} revealed={revealed} />

          <p
            className="drill-heard"
            role="status"
            aria-live="polite"
            data-correct={heard && !paused ? String(heard.correct) : undefined}
          >
            {micError ??
              (paused
                ? 'Écoute en pause.'
                : heard
                  ? `${heard.correct ? 'Juste' : 'Non'} : vous avez joué ${NOTE_NAMES[pitchClassOf(heard.midi)]}`
                  : 'À l’écoute…')}
          </p>

          <div className="drill-bar">
            <span className="drill-score">
              <b>{score.right}</b>/{score.tries} justes · série <b>{score.streak}</b>
              {mode === 'timed' && (
                <>
                  {' · '}
                  <b className="drill-clock">{secondsLeft} s</b>
                </>
              )}
            </span>
            <button type="button" className="btn" onClick={() => setPaused(!paused)}>
              <Icon name={paused ? 'mic' : 'micOff'} />
              {paused ? 'Reprendre l’écoute' : 'Couper l’écoute'}
            </button>
            {revealed ? (
              <button type="button" className="btn" onClick={next}>
                Note suivante
              </button>
            ) : (
              <button type="button" className="btn" onClick={reveal}>
                {mode === 'timed' ? 'Passer' : 'Voir la réponse'}
              </button>
            )}
          </div>
        </>
      )}

      {saveError && (
        <p className="drill-error" role="alert">
          Les résultats n’ont pas pu être enregistrés : vérifiez que l’application est toujours lancée.
        </p>
      )}
      {data && <History sessions={data.sessions} notes={notes} />}
    </div>
  )
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Les dernières séances, et les notes le plus souvent ratées. */
function History({ sessions, notes }: { sessions: TrainerData['sessions']; notes: NoteStatsMap }) {
  const recent = sessions.slice(-5).reverse()
  const weak = Object.entries(notes)
    .filter(([, n]) => n.misses > 0)
    .sort(([, a], [, b]) => b.misses / b.tries - a.misses / a.tries || b.misses - a.misses)
    .slice(0, 5)

  return (
    <div className="drill-history">
      <section>
        <h3>Dernières séances</h3>
        {recent.length === 0 ? (
          <p className="drill-empty">Aucune séance enregistrée.</p>
        ) : (
          <ul>
            {recent.map((s) => (
              <li key={s.date}>
                <span>{dateFormat.format(new Date(s.date))}</span>
                <span>{s.mode === 'timed' ? `Défi ${CHALLENGE_SECONDS} s` : 'Libre'}</span>
                <b>
                  {s.right}/{s.tries}
                </b>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>Notes à travailler</h3>
        {weak.length === 0 ? (
          <p className="drill-empty">Aucune note ratée pour l’instant.</p>
        ) : (
          <ul>
            {weak.map(([key, n]) => {
              const [string, pitchClass] = key.split('-').map(Number)
              return (
                <li key={key}>
                  <span>
                    {NOTE_NAMES[pitchClass]} · {STRINGS[string].name}
                  </span>
                  <b>
                    {n.misses} sur {n.tries}
                  </b>
                </li>
              )
            })}
          </ul>
        )}
      </section>
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
