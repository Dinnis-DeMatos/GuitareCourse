import { useCallback, useEffect, useRef, useState } from 'react'
import { createStopwatch } from '../stopwatch.ts'
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
/** Compte à rebours avant la séance, en secondes : le temps de poser la main sur le manche. */
const COUNTDOWN_SECONDS = 3

type RoundPhase = 'ready' | 'countdown' | 'running' | 'done'

/** Dernière note entendue : juste, ou fausse (`octave` : bon nom de note, mauvaise octave). */
type Heard = { midi: number; correct: boolean; octave: boolean } | null
/** Libre, série d'une longueur fixe, ou défi chronométré. */
type Mode = 'free' | 'series' | 'timed'

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
    if (open && !element.open) {
      element.showModal()
      // Le focus sur la fenêtre, pas sur son premier bouton (« Fermer ») : Espace pilote alors l'écoute.
      element.focus()
    }
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet trainer"
      aria-labelledby="trainer-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet-body">
        {/* « Fermer » en haut, à côté du titre : toute la hauteur reste à l'exercice. */}
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">Exercice</p>
            <h2 id="trainer-title">Connaissance du manche</h2>
          </div>
          <div className="trainer-actions">
            {/* Le panneau qu'il ouvre est dans l'exercice (Drill), qui en connaît les réglages. */}
            <button type="button" className="btn drill-settings-button" popoverTarget="trainer-settings">
              <Icon name="settings" />
              Réglages
            </button>
            <button type="button" className="btn" onClick={onClose}>
              <Icon name="close" />
              Fermer
            </button>
          </div>
        </div>
        {open && <Drill />}
      </div>
    </dialog>
  )
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isMode(value: unknown): value is Mode {
  return value === 'free' || value === 'series' || value === 'timed'
}

/** Longueurs de série proposées dans les réglages, en nombre de notes. */
const SERIES_LENGTHS = [10, 20, 30, 50]

function isSeriesLength(value: unknown): value is number {
  return SERIES_LENGTHS.includes(value as number)
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
  const [seriesLength, setSeriesLength] = usePersistentState('guitarecourse.trainer.seriesLength', 20, isSeriesLength)
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
  // `time` : temps total des bonnes réponses, pour le temps de réponse moyen ; `count` : consignes terminées.
  const [score, setScore] = useState({ right: 0, tries: 0, streak: 0, time: 0, count: 0 })
  const [micError, setMicError] = useState<string | null>(null)
  // Micro choisi ('' : celui de Windows par défaut), et les micros branchés.
  const [micId, setMicId] = usePersistentState('guitarecourse.trainer.mic', '', (value): value is string => typeof value === 'string')
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  // La jauge de niveau est mise à jour à chaque image, directement dans la page (sans repasser par React).
  const meter = useRef<HTMLDivElement>(null)

  // Liste des micros, tenue à jour quand on en branche ou débranche un. Leurs noms ne sont connus
  // qu'une fois le micro autorisé : la liste est donc aussi relue à chaque ouverture du micro.
  const listMics = useCallback(() => {
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setMics(devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')))
  }, [])
  useEffect(() => {
    listMics()
    navigator.mediaDevices.addEventListener('devicechange', listMics)
    return () => navigator.mediaDevices.removeEventListener('devicechange', listMics)
  }, [listMics])
  // Écoute coupée à la demande (on parle, la pièce est bruyante) : le micro est alors fermé.
  const [paused, setPaused] = useState(false)

  // Espace coupe ou reprend l'écoute. Seule exception : en navigation au clavier (Tab), Espace garde son
  // rôle sur le bouton ou la case atteints. Après un clic, Espace revient à l'écoute ; son relâchement est
  // aussi intercepté, sans quoi il cliquerait le dernier bouton cliqué ou cocherait la dernière case.
  useEffect(() => {
    let keyboard = false
    const onPointerDown = () => {
      keyboard = false
    }
    const isSpace = (event: KeyboardEvent) =>
      event.key === ' ' &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !(keyboard && event.target instanceof Element && event.target.matches('button, input, a[href]'))
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') keyboard = true
      if (!isSpace(event)) return
      event.preventDefault()
      if (!event.repeat) setPaused((value) => !value)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (isSpace(event)) event.preventDefault()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [])
  // Défi : prêt à lancer, en cours (jusqu'à `endsAt`), ou terminé.
  // La séance (libre ou défi) se lance et s'arrête à la main : rien n'est écouté ni compté avant ou après.
  // Prête à lancer, compte à rebours (jusqu'à `endsAt`), en cours (un défi s'arrête seul à `endsAt`), ou
  // terminée. `best` : le record du défi au lancement, pour dire ensuite s'il est battu ou égalé.
  const [round, setRound] = useState({ phase: 'ready' as RoundPhase, endsAt: 0, best: 0 })
  const [now, setNow] = useState(() => Date.now())

  const listening = round.phase === 'running'

  // L'écoute et les minuteries tournent hors de React : elles lisent l'état en cours dans ces références.
  const targetRef = useRef(target)
  const revealedRef = useRef(revealed)
  const listeningRef = useRef(listening)
  const notesRef = useRef(notes)
  const modeRef = useRef(mode)
  const zoneRef = useRef(zone)
  const seriesLengthRef = useRef(seriesLength)
  const soundRef = useRef(sound)
  useEffect(() => {
    targetRef.current = target
    revealedRef.current = revealed
    listeningRef.current = listening
    notesRef.current = notes
    modeRef.current = mode
    zoneRef.current = zone
    seriesLengthRef.current = seriesLength
    soundRef.current = sound
  }, [target, revealed, listening, notes, mode, zone, sound, seriesLength])

  // Le temps de réponse court depuis l'arrivée de la consigne, sans compter les pauses de l'écoute.
  const running = listening && !paused
  const runningRef = useRef(running)
  const [stopwatch] = useState(() => createStopwatch())
  useEffect(() => {
    runningRef.current = running
    if (running) stopwatch.start()
    else stopwatch.stop()
  }, [running, stopwatch])
  useEffect(() => {
    stopwatch.reset(runningRef.current)
  }, [target, stopwatch])

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
  const flush = useCallback((sessionMode: Mode): Promise<void> => {
    const done = session.current
    session.current = newSession()
    if (done.tries === 0) return Promise.resolve()
    return saveSession(sessionMode, done).then(
      (saved) => {
        setData(saved)
        setSaveError(false)
      },
      () => setSaveError(true),
    )
  }, [])

  // Fermer la fenêtre de l'exercice, ou l'application, termine la séance libre en cours ; un défi n'est
  // enregistré qu'une fois mené à son terme. L'application de bureau attend cet enregistrement avant de
  // se fermer (electron/main.ts) ; dans un navigateur, `pagehide` en donne au moins la chance.
  useEffect(() => {
    const save = () => (modeRef.current === 'free' ? flush('free') : Promise.resolve())
    const hooks = window as { saveTrainerSession?: () => Promise<void> }
    hooks.saveTrainerSession = save
    window.addEventListener('pagehide', save)
    return () => {
      delete hooks.saveTrainerSession
      window.removeEventListener('pagehide', save)
      void save()
    }
  }, [flush])

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
    setScore((s) => ({ ...s, count: s.count + 1 }))
    // Une série s'achève avec sa dernière consigne.
    const count = Object.values(session.current.notes).reduce((sum, n) => sum + n.tries, 0)
    if (modeRef.current === 'series' && count >= seriesLengthRef.current) {
      setRound((r) => ({ ...r, phase: 'done' }))
      void flush('series')
    }
  }, [flush])

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
      const time = Math.round(stopwatch.read())
      setHeard({ midi, correct, octave })
      setScore((s) => ({
        ...s,
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
    [finish, stopwatch],
  )

  const reveal = () => {
    setRevealed(true)
    setHeard(null)
    setScore((s) => ({ ...s, tries: s.tries + 1, streak: 0 }))
    finish(target, null)
  }

  // Le compte à rebours avant la séance, puis celui du défi.
  useEffect(() => {
    const counting = round.phase === 'countdown'
    if (!counting && (round.phase !== 'running' || mode !== 'timed')) return
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time < round.endsAt) return
      if (counting) {
        setRound((r) => ({ ...r, phase: 'running', endsAt: mode === 'timed' ? time + CHALLENGE_SECONDS * 1000 : 0 }))
      } else {
        setRound((r) => ({ ...r, phase: 'done' }))
        void flush('timed')
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [round, mode, flush])

  // La consigne est tirée au lancement mais reste cachée pendant le compte à rebours : son temps de
  // réponse ne part qu'avec la séance.
  const start = () => {
    session.current = newSession()
    setScore({ right: 0, tries: 0, streak: 0, time: 0, count: 0 })
    next()
    setNow(Date.now())
    setRound({ phase: 'countdown', endsAt: Date.now() + COUNTDOWN_SECONDS * 1000, best })
  }

  /** Arrête la séance sans fermer la fenêtre : la séance libre est enregistrée ; une série ou un défi interrompus ne comptent pas. */
  const stop = () => {
    if (mode === 'free' && round.phase === 'running') {
      void flush('free')
      setRound((r) => ({ ...r, phase: 'done' }))
    } else {
      session.current = newSession()
      setRound((r) => ({ ...r, phase: 'ready' }))
    }
  }

  const changeMode = (value: Mode) => {
    if (value === mode) return
    // La séance libre est enregistrée ; une série ou un défi interrompus ne comptent pas.
    if (mode === 'free') void flush('free')
    else session.current = newSession()
    setMode(value)
    setRound({ phase: 'ready', endsAt: 0, best: 0 })
    setScore({ right: 0, tries: 0, streak: 0, time: 0, count: 0 })
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
      // `ideal` : si le micro choisi a été débranché, on prend celui par défaut plutôt que d'échouer.
      .getUserMedia({
        audio: {
          deviceId: micId ? { ideal: micId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop())
        stream = media
        setMicError(null)
        listMics()
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
          const rms = rmsOf(samples)
          const frequency = detectPitch(samples, context!.sampleRate, gate.threshold())
          gate.update(rms, frequency !== null)
          showLevel(meter.current, rms, gate.threshold())
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
  }, [judge, paused, micId, listMics])

  const secondsLeft = Math.max(0, Math.ceil((round.endsAt - now) / 1000))
  const idle = round.phase !== 'running'
  const counting = round.phase === 'countdown'
  const startLabel =
    mode === 'free'
      ? round.phase === 'done'
        ? 'Nouvelle séance'
        : 'Commencer la séance'
      : round.phase === 'done'
        ? 'Rejouer'
        : mode === 'series'
          ? 'Lancer la série'
          : 'Lancer le défi'
  const best = (data?.sessions ?? []).filter((s) => s.mode === 'timed').reduce((max, s) => Math.max(max, s.right), 0)
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

  return (
    <div className="drill">
      <div className="drill-main">
        <div className="drill-options">
          <div className="drill-group" role="group" aria-label="Mode">
            <button type="button" className="btn" aria-pressed={mode === 'free'} onClick={() => changeMode('free')}>
              Libre
            </button>
            <button type="button" className="btn" aria-pressed={mode === 'series'} onClick={() => changeMode('series')}>
              Série de {seriesLength}
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

        {/* Les réglages : un panneau ouvert à la demande, qui se ferme d'un clic à côté ou avec Échap. */}
        <div id="trainer-settings" popover="auto" className="drill-settings">
          <h3>Réglages</h3>
          <section>
            <h4 id="notes-asked">Notes demandées</h4>
            <div className="drill-group" role="group" aria-labelledby="notes-asked">
              <button
                type="button"
                className="btn"
                aria-pressed={!sharps}
                onClick={() => sharps && changeOptions({ sharps: false, strings, zone })}
              >
                Naturelles
              </button>
              <button
                type="button"
                className="btn"
                aria-pressed={sharps}
                onClick={() => !sharps && changeOptions({ sharps: true, strings, zone })}
              >
                Avec altérations (♯)
              </button>
            </div>
          </section>
          <section>
            <h4 id="success-sound">Son quand c’est juste</h4>
            <div className="drill-group" role="group" aria-labelledby="success-sound">
              <button type="button" className="btn" aria-pressed={sound} onClick={() => setSound(true)}>
                Activé
              </button>
              <button type="button" className="btn" aria-pressed={!sound} onClick={() => setSound(false)}>
                Coupé
              </button>
            </div>
          </section>
          <section>
            <h4 id="series-length">Longueur d’une série</h4>
            <div className="drill-group" role="group" aria-labelledby="series-length">
              {SERIES_LENGTHS.map((length) => (
                <button
                  key={length}
                  type="button"
                  className="btn"
                  aria-pressed={length === seriesLength}
                  // Une série en cours garde sa longueur : on la change entre deux séries.
                  disabled={mode === 'series' && round.phase !== 'ready' && round.phase !== 'done'}
                  onClick={() => setSeriesLength(length)}
                >
                  {length} notes
                </button>
              ))}
            </div>
          </section>
          <section>
            <h4>
              <label htmlFor="trainer-mic">Micro</label>
            </h4>
            <span className="method-picker">
              <select id="trainer-mic" value={micId} onChange={(event) => setMicId(event.target.value)}>
                <option value="">Micro par défaut de Windows</option>
                {mics.map((mic, i) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Micro ${i + 1}`}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" />
            </span>
          </section>
          <section>
            <h4 id="mic-level">Niveau du micro</h4>
            <div
              ref={meter}
              className="drill-meter"
              data-off={paused || undefined}
              role="meter"
              aria-labelledby="mic-level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={0}
            >
              <i />
            </div>
            <p className="drill-settings-note">
              Grattez une corde : la jauge doit dépasser le trait, qui marque le seuil du bruit de la pièce. En
              dessous, le son est ignoré.
            </p>
          </section>
        </div>

        {/* Même disposition avant, pendant et après la séance : la fenêtre ne change pas de taille. */}
        <p className="drill-prompt">
          {!idle ? (
            <>
              Jouez <b>{NOTE_NAMES[target.pitchClass]}</b> sur la corde de <b>{STRINGS[target.string].name}</b>
            </>
          ) : counting ? (
            'Préparez-vous…'
          ) : round.phase === 'ready' ? (
            mode === 'timed' ? (
              `Trouvez un maximum de notes en ${CHALLENGE_SECONDS} secondes.`
            ) : mode === 'series' ? (
              `Trouvez ${seriesLength} notes, le plus vite possible.`
            ) : (
              'Guitare en main ? Lancez la séance.'
            )
          ) : mode === 'timed' ? (
            <>
              <b>{plural(score.right, 'note')}</b> en {CHALLENGE_SECONDS} secondes
              {score.right > round.best
                ? ' : nouveau record !'
                : score.right > 0 && score.right === round.best
                  ? ' : record égalé'
                  : ` · record : ${round.best}`}
            </>
          ) : (
            <>
              {mode === 'series' ? `Série de ${seriesLength} terminée` : 'Séance terminée'} : <b>{score.right}</b>/
              {score.tries} justes
            </>
          )}
        </p>

        <div className="drill-board" data-idle={idle || undefined}>
          <Fretboard
            highlight={idle ? undefined : target.string}
            zone={zone}
            label={idle ? 'Manche' : `Manche, corde de ${STRINGS[target.string].name}, ${zone.label.toLowerCase()}`}
            marks={!idle && revealed ? fretsOf(target, zone).map((fret) => ({ string: target.string, fret, className: 'fb-answer' })) : []}
          />
          {counting ? (
            <div className="drill-start drill-count" aria-live="assertive">
              {secondsLeft}
            </div>
          ) : (
            idle && (
              <button type="button" className="drill-start" onClick={start}>
                <Icon name="pick" />
                <span>{startLabel}</span>
              </button>
            )
          )}
        </div>

        <p
          className="drill-heard"
          role="status"
          aria-live="polite"
          data-correct={!idle && heard && !paused ? String(heard.correct) : undefined}
        >
          {micError ??
            (idle
              ? score.right > 0 && round.phase === 'done'
                ? `Temps de réponse moyen : ${formatTime(score.time / score.right)}`
                : mode === 'timed' && best > 0
                  ? `Record : ${plural(best, 'note')}. Rien n’est compté avant le lancement.`
                  : 'Rien n’est écouté ni compté avant le lancement.'
              : paused
                ? 'Écoute en pause.'
                : heard
                  ? heardMessage(heard, targetMidis(target, zone))
                  : 'À l’écoute…')}
        </p>

        <div className="drill-bar">
          <span className="drill-score">
            {idle && round.phase === 'ready' ? (
              'Micro et niveau d’écoute : dans Réglages.'
            ) : (
              <>
                <b>{score.right}</b>/{score.tries} justes · série <b>{score.streak}</b>
                {score.right > 0 && (
                  <>
                    {' · moy. '}
                    <b>{formatTime(score.time / score.right)}</b>
                  </>
                )}
                {mode === 'timed' && !idle && (
                  <>
                    {' · '}
                    <b className="drill-clock">{secondsLeft} s</b>
                  </>
                )}
                {mode === 'series' && !idle && (
                  <>
                    {' · note '}
                    <b className="drill-clock">
                      {Math.min(score.count + 1, seriesLength)}/{seriesLength}
                    </b>
                  </>
                )}
              </>
            )}
          </span>
          {(!idle || counting) && (
            <button type="button" className="btn" onClick={stop}>
              <Icon name="close" />
              {mode === 'timed' ? 'Arrêter le défi' : mode === 'series' ? 'Arrêter la série' : 'Arrêter la séance'}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setPaused(!paused)} aria-keyshortcuts="Space">
            <Icon name={paused ? 'mic' : 'micOff'} />
            {paused ? 'Reprendre l’écoute' : 'Couper l’écoute'}
            <kbd>Espace</kbd>
          </button>
          {!idle &&
            (revealed ? (
              <button type="button" className="btn" onClick={next}>
                Note suivante
              </button>
            ) : (
              <button type="button" className="btn" onClick={reveal}>
                {mode === 'free' ? 'Voir la réponse' : 'Passer'}
              </button>
            ))}
        </div>

        {saveError && (
          <p className="drill-error" role="alert">
            Les résultats n’ont pas pu être enregistrés : vérifiez que l’application est toujours lancée.
          </p>
        )}
      </div>
      {/* À droite, le suivi : historique, notes à travailler, carte du manche. */}
      {data && (
        <aside className="drill-side" aria-label="Progression">
          <History sessions={data.sessions} notes={notes} />
          <ProgressMap notes={notes} />
        </aside>
      )}
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
                <span>{s.mode === 'timed' ? `Défi ${CHALLENGE_SECONDS} s` : s.mode === 'series' ? 'Série' : 'Libre'}</span>
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

/** Niveau d'un extrait sur la jauge, de 0 à 1 : de -60 dB (silence) à 0 dB (saturation). */
function levelOf(rms: number): number {
  return Math.min(1, Math.max(0, 1 + (20 * Math.log10(rms)) / 60))
}

/** Met la jauge à jour : niveau, seuil du bruit, et si le son passe ce seuil. */
function showLevel(element: HTMLElement | null, rms: number, threshold: number) {
  if (!element) return
  const level = levelOf(rms)
  element.style.setProperty('--level', String(level))
  element.style.setProperty('--gate', String(threshold > 0 ? levelOf(threshold) : 0))
  element.toggleAttribute('data-loud', threshold > 0 && rms >= threshold)
  element.setAttribute('aria-valuenow', String(Math.round(level * 100)))
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
