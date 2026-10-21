import { useCallback, useEffect, useRef, useState } from 'react'
import { usePersistentState } from '../usePersistentState.ts'
import { Icon } from './Icon.tsx'
import {
  averageTime,
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
  targetMidis,
  ZONES,
  type NoteStats,
  type NoteStatsMap,
  type Target,
  type Zone,
} from '../pitch.ts'

// Une note doit tenir quelques images d'affilée pour compter : on évite ainsi l'attaque et les parasites.
const STABLE_FRAMES = 5
// Temps laissé pour voir la bonne case avant la note suivante.
const REVEAL_MS = 1400
/** Durée du défi, en secondes. */
const CHALLENGE_SECONDS = 60

/** Dernière note entendue : juste, ou fausse (`octave` : bon nom de note, mauvaise octave). */
type Heard = { midi: number; correct: boolean; octave: boolean } | null
type Mode = 'free' | 'timed'

/** Mêmes données que server/trainer.ts. */
interface TrainerData {
  notes: NoteStatsMap
  sessions: { date: string; mode: Mode; right: number; tries: number; time?: number }[]
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

function isZone(value: unknown): value is string {
  return ZONES.some((zone) => zone.id === value)
}

const ALL_STRINGS = STRINGS.map((_, i) => i)

const seconds = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** « 2,4 s » */
const formatTime = (ms: number) => `${seconds.format(ms / 1000)} s`

/**
 * Le petit son d'une bonne réponse : deux notes claires et brèves. Elles sont plus aiguës que tout ce que
 * l'écoute reconnaît, et la consigne suivante n'arrive qu'après : le micro ne les prend pas pour une réponse.
 */
function ding() {
  const context = new AudioContext()
  const start = context.currentTime
  for (const [i, frequency] of [1568, 2093].entries()) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = frequency
    const at = start + i * 0.08
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.4)
  }
  window.setTimeout(() => void context.close(), 600)
}

/** Séance en cours, pas encore enregistrée ; `time` : temps total des bonnes réponses, en millisecondes. */
type Session = { right: number; tries: number; time: number; notes: NoteStatsMap }
const newSession = (): Session => ({ right: 0, tries: 0, time: 0, notes: {} })

/** Ajoute une note au bilan : présentée une fois de plus, ratée ou non, et trouvée en `time` ms (sinon null). */
function addResult(notes: NoteStatsMap, key: string, miss: boolean, time: number | null): NoteStatsMap {
  const before: NoteStats = notes[key] ?? { tries: 0, misses: 0 }
  return {
    ...notes,
    [key]: {
      tries: before.tries + 1,
      misses: before.misses + (miss ? 1 : 0),
      found: (before.found ?? 0) + (time === null ? 0 : 1),
      time: (before.time ?? 0) + (time ?? 0),
    },
  }
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
  const [zoneId, setZoneId] = usePersistentState('guitarecourse.trainer.zone', ZONES[0].id, isZone)
  const [sound, setSound] = usePersistentState('guitarecourse.trainer.sound', true, isBoolean)
  const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0]
  // Séances enregistrées ; et bilan de chaque note, complété au fil de la séance (il guide le tirage).
  const [data, setData] = useState<TrainerData | null>(null)
  const [notes, setNotes] = useState<NoteStatsMap>({})
  const [saveError, setSaveError] = useState(false)
  const [target, setTarget] = useState<Target>(() => randomTarget(null, { sharps, strings, zone }))
  const [revealed, setRevealed] = useState(false)
  const [heard, setHeard] = useState<Heard>(null)
  // `time` : temps total des bonnes réponses, pour le temps de réponse moyen.
  const [score, setScore] = useState({ right: 0, tries: 0, streak: 0, time: 0 })
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
  const zoneRef = useRef(zone)
  const soundRef = useRef(sound)
  useEffect(() => {
    targetRef.current = target
    revealedRef.current = revealed
    listeningRef.current = listening
    notesRef.current = notes
    modeRef.current = mode
    zoneRef.current = zone
    soundRef.current = sound
  }, [target, revealed, listening, notes, mode, zone, sound])

  // Le temps de réponse court depuis l'arrivée de la consigne, ou depuis la reprise de l'écoute.
  const shownAt = useRef(0)
  useEffect(() => {
    shownAt.current = performance.now()
  }, [target, paused, listening])

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

  /** Bilan de la consigne qui se termine : trouvée (en `time` ms) du premier coup, ou ratée (`time` null). */
  const finish = useCallback((done: Target, time: number | null) => {
    const key = noteKey(done)
    const miss = time === null || missed.current
    session.current.tries++
    if (time !== null) {
      session.current.right++
      session.current.time += time
    }
    session.current.notes = addResult(session.current.notes, key, miss, time)
    setNotes((current) => addResult(current, key, miss, time))
  }, [])

  const next = useCallback(() => {
    missed.current = false
    setTarget((previous) => randomTarget(previous, { sharps, strings, zone }, notesRef.current))
    setRevealed(false)
    setHeard(null)
  }, [sharps, strings, zone])

  // Après une bonne réponse (ou « Voir la réponse »), on montre la case puis on passe à la suivante.
  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(next, REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [revealed, next])

  const judge = useCallback(
    (midi: number) => {
      if (revealedRef.current || !listeningRef.current) return
      const correct = targetMidis(targetRef.current, zoneRef.current).includes(midi)
      const octave = !correct && pitchClassOf(midi) === targetRef.current.pitchClass
      const time = Math.round(performance.now() - shownAt.current)
      setHeard({ midi, correct, octave })
      setScore((s) => ({
        right: s.right + (correct ? 1 : 0),
        tries: s.tries + 1,
        streak: correct ? s.streak + 1 : 0,
        time: s.time + (correct ? time : 0),
      }))
      if (correct) {
        if (soundRef.current) ding()
        finish(targetRef.current, time)
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
    finish(target, null)
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
    setScore({ right: 0, tries: 0, streak: 0, time: 0 })
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
    setScore({ right: 0, tries: 0, streak: 0, time: 0 })
    next()
  }

  /** Change les cordes, la zone ou les altérations : la consigne en cours est remplacée. */
  const changeOptions = (options: { sharps: boolean; strings: number[]; zone: Zone }) => {
    setSharps(options.sharps)
    setStrings(options.strings)
    setZoneId(options.zone.id)
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
                  zone,
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
            onChange={(event) => changeOptions({ sharps: event.target.checked, strings, zone })}
          />
          Altérations (♯)
        </label>
        <label className="drill-option">
          <input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />
          Son quand c’est juste
        </label>
        <div className="drill-group" role="group" aria-label="Zone du manche">
          {ZONES.map((z) => (
            <button
              key={z.id}
              type="button"
              className="btn"
              aria-pressed={z.id === zone.id}
              onClick={() => changeOptions({ sharps, strings, zone: z })}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'timed' && challenge.phase !== 'running' ? (
        <div className="drill-challenge">
          <p className="drill-prompt">
            {challenge.phase === 'done' ? (
              <>
                <b>{plural(score.right, 'note')}</b> en {CHALLENGE_SECONDS} secondes
                {score.right > 0 && score.right >= best ? ' : nouveau record !' : ` · record : ${best}`}
                {score.right > 0 && <span className="drill-record"> Temps moyen : {formatTime(score.time / score.right)}</span>}
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

          <Fretboard
            highlight={target.string}
            zone={zone}
            label={`Manche, corde de ${STRINGS[target.string].name}, ${zone.label.toLowerCase()}`}
            marks={revealed ? fretsOf(target, zone).map((fret) => ({ string: target.string, fret, className: 'fb-answer' })) : []}
          />

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
                  ? heardMessage(heard, targetMidis(target, zone))
                  : 'À l’écoute…')}
          </p>

          <div className="drill-bar">
            <span className="drill-score">
              <b>{score.right}</b>/{score.tries} justes · série <b>{score.streak}</b>
              {score.right > 0 && (
                <>
                  {' · moy. '}
                  <b>{formatTime(score.time / score.right)}</b>
                </>
              )}
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
      {data && <ProgressMap notes={notes} />}
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
                  {s.time !== undefined && s.right > 0 && ` · ${formatTime(s.time / s.right)}`}
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
                    {averageTime(n) !== null && ` · ${formatTime(averageTime(n)!)}`}
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

/** Une pastille posée sur le manche, à une case d'une corde. */
type Mark = { string: number; fret: number; className: string; title?: string }

const fretX = (fret: number) => (fret === 0 ? NUT / 2 : NUT + FRET_W * (fret - 0.5))
const stringY = (string: number) => TOP + STRING_GAP * string

/**
 * Le manche en vue de tablature (Mi aigu en haut), cases 0 à 12 : une corde soulignée, une zone éclairée,
 * des pastilles (la bonne case une fois trouvée, ou la carte de progression).
 */
function Fretboard({ highlight, zone, marks, label }: { highlight?: number; zone?: Zone; marks: Mark[]; label: string }) {
  const width = NUT + FRET_W * FRETS
  const bottom = TOP + STRING_GAP * (STRINGS.length - 1)
  const middle = (TOP + bottom) / 2
  // La zone va du bord gauche de sa première case au bord droit de sa dernière (la case 0 est avant le sillet).
  const zoneLeft = zone && (zone.from === 0 ? 0 : NUT + FRET_W * (zone.from - 1))
  const zoneRight = zone && NUT + FRET_W * zone.to

  return (
    <svg className="fretboard" viewBox={`0 0 ${width + 8} ${bottom + 34}`} role="img" aria-label={label}>
      {zone && zone.to - zone.from < FRETS && (
        <rect className="fb-zone" x={zoneLeft} y={TOP - 10} width={zoneRight! - zoneLeft!} height={bottom - TOP + 20} />
      )}
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
          data-target={i === highlight || undefined}
          x1={0}
          x2={width}
          y1={stringY(i)}
          y2={stringY(i)}
          strokeWidth={1 + i * 0.35}
        />
      ))}
      {marks.map((mark) => (
        <circle key={`${mark.string}-${mark.fret}`} className={mark.className} cx={fretX(mark.fret)} cy={stringY(mark.string)} r="8">
          {mark.title && <title>{mark.title}</title>}
        </circle>
      ))}
    </svg>
  )
}

/** Ce que dit l'exercice de la dernière note entendue. */
function heardMessage(heard: NonNullable<Heard>, expected: number[]): string {
  const name = NOTE_NAMES[pitchClassOf(heard.midi)]
  if (heard.correct) return `Juste : ${name}`
  if (heard.octave) return `Bonne note, mauvaise octave : jouez-la plus ${heard.midi > Math.max(...expected) ? 'grave' : 'aiguë'}`
  return `Non : vous avez joué ${name}`
}

type MapView = 'errors' | 'time'

/** Niveau d'une note sur la carte : bon, moyen ou à travailler ; null si elle n'a pas encore été vue. */
function level(stats: NoteStats | undefined, view: MapView): 'good' | 'fair' | 'weak' | null {
  if (view === 'errors') {
    if (!stats?.tries) return null
    const rate = stats.misses / stats.tries
    return rate < 0.2 ? 'good' : rate < 0.5 ? 'fair' : 'weak'
  }
  const time = averageTime(stats)
  if (time === null) return null
  return time < 3000 ? 'good' : time < 6000 ? 'fair' : 'weak'
}

const LEGEND: Record<MapView, Record<'good' | 'fair' | 'weak', string>> = {
  errors: { good: 'moins de 20 % d’erreurs', fair: '20 à 50 %', weak: 'plus de 50 %' },
  time: { good: 'moins de 3 s', fair: '3 à 6 s', weak: 'plus de 6 s' },
}

/** Le manche entier, chaque case colorée selon les erreurs ou le temps de réponse de sa note. */
function ProgressMap({ notes }: { notes: NoteStatsMap }) {
  const [view, setView] = useState<MapView>('errors')
  const marks: Mark[] = []
  for (const [string, { name, midi }] of STRINGS.entries()) {
    for (let fret = 0; fret <= FRETS; fret++) {
      const pitchClass = pitchClassOf(midi + fret)
      const stats = notes[noteKey({ string, pitchClass })]
      const value = level(stats, view)
      if (!stats || !value) continue
      const time = averageTime(stats)
      marks.push({
        string,
        fret,
        className: `fb-level fb-${value}`,
        title: `${NOTE_NAMES[pitchClass]} · ${name}, case ${fret} : ${stats.misses} ratée${stats.misses > 1 ? 's' : ''} sur ${stats.tries}${time === null ? '' : `, ${formatTime(time)} en moyenne`}`,
      })
    }
  }

  return (
    <section className="drill-map">
      <div className="drill-map-head">
        <h3>Carte du manche</h3>
        <div className="drill-group" role="group" aria-label="Couleur des cases">
          <button type="button" className="btn" aria-pressed={view === 'errors'} onClick={() => setView('errors')}>
            Erreurs
          </button>
          <button type="button" className="btn" aria-pressed={view === 'time'} onClick={() => setView('time')}>
            Temps de réponse
          </button>
        </div>
      </div>
      {marks.length === 0 ? (
        <p className="drill-empty">La carte se remplit au fil des séances.</p>
      ) : (
        <>
          <Fretboard marks={marks} label={`Carte du manche : ${view === 'errors' ? 'erreurs' : 'temps de réponse'} par case`} />
          <ul className="drill-legend">
            {(['good', 'fair', 'weak'] as const).map((value) => (
              <li key={value}>
                <i className={`fb-${value}`} aria-hidden="true" />
                {LEGEND[view][value]}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
