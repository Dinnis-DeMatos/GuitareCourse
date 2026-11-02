import { useEffect, useRef, useState, type RefObject } from 'react'
import { AlphaTabApi, LayoutMode, PlayerMode, StaveProfile, synth, type model } from '@coderline/alphatab'
import { clampBpm, MAX_BPM, MIN_BPM } from '../metronome.ts'
import { formatTime } from '../progress.ts'
import { fixOpenStrings, roundTempos } from '../score.ts'
import { Icon, type IconName } from './Icon.tsx'

/** Le pas des boutons − et + : on monte un passage au métronome de 5 en 5. */
const BPM_STEP = 5

/** Ce que les raccourcis clavier de la leçon pilotent quand la partition est affichée. */
export interface ScoreControls {
  playPause: () => void
}

/**
 * Une tablature Guitar Pro (.gp, .gpx) dessinée et jouée par alphaTab, à la place de la vidéo : la
 * partition défile sous un curseur, on la ralentit, on boucle les mesures choisies en glissant dessus.
 */
export function ScoreView({
  url,
  title,
  volume,
  controlsRef,
  back = { group: 'Vidéo', label: 'Revenir à la vidéo', icon: 'play' },
  onClose,
}: {
  url: string
  title: string
  /** De 0 à 1 : le volume de la leçon. */
  volume: number
  controlsRef: RefObject<ScoreControls | null>
  /** Le bouton qui ferme la partition : vers la vidéo de la leçon, ou ailleurs. */
  back?: { group: string; label: string; icon: IconName }
  onClose: () => void
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [tracks, setTracks] = useState<model.Track[]>([])
  const [track, setTrack] = useState(0)
  // Le tempo du début du morceau, et celui qu'on joue : la lecture va au rapport des deux.
  const [original, setOriginal] = useState<number | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  const [looping, setLooping] = useState(false)
  const [range, setRange] = useState(false)
  const [metronome, setMetronome] = useState(false)
  const [countIn, setCountIn] = useState(false)
  const [time, setTime] = useState({ current: 0, end: 0 })

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const api = new AlphaTabApi(sheet, {
      // Polices et banque de sons copiées à la racine de l'application par le plugin Vite d'alphaTab.
      core: { file: url, fontDirectory: '/font/' },
      display: { layoutMode: LayoutMode.Page, staveProfile: StaveProfile.Tab },
      player: {
        playerMode: PlayerMode.EnabledSynthesizer,
        soundFont: '/soundfont/sonivox.sf2',
        scrollElement: scrollRef.current ?? undefined,
      },
    })
    apiRef.current = api
    controlsRef.current = { playPause: () => api.isReadyForPlayback && api.playPause() }
    api.error.on(() => setFailed(true))
    // Appelé avant le dessin : la correction est prise en compte dès le premier rendu.
    api.scoreLoaded.on((score) => {
      fixOpenStrings(score)
      roundTempos(score)
      setTracks(score.tracks)
      const tempo = Math.round(score.tempo)
      setOriginal(tempo)
      setBpm(tempo)
    })
    api.playerReady.on(() => setReady(true))
    api.playerStateChanged.on((event) => setPlaying(event.state === synth.PlayerState.Playing))
    api.playbackRangeChanged.on((event) => setRange(event.playbackRange !== null))
    // Le compteur ne bouge qu'à la seconde : inutile de redessiner à chaque note.
    api.playerPositionChanged.on((event) => {
      const current = Math.floor(event.currentTime / 1000)
      const end = Math.floor(event.endTime / 1000)
      setTime((last) => (last.current === current && last.end === end ? last : { current, end }))
    })
    return () => {
      controlsRef.current = null
      apiRef.current = null
      api.destroy()
    }
  }, [url, controlsRef])

  useEffect(() => {
    if (apiRef.current) apiRef.current.masterVolume = volume
  }, [volume, ready])

  function showTrack(index: number) {
    const api = apiRef.current
    const chosen = tracks[index]
    if (!api || !chosen) return
    setTrack(index)
    api.renderTracks([chosen])
  }

  function changeBpm(value: number) {
    if (!original) return
    const next = clampBpm(value)
    setBpm(next)
    if (apiRef.current) apiRef.current.playbackSpeed = next / original
  }

  function commitDraft() {
    if (draft && !cancelled.current) changeBpm(Number(draft))
    cancelled.current = false
    setDraft(null)
  }

  function toggleLoop() {
    setLooping(!looping)
    if (apiRef.current) apiRef.current.isLooping = !looping
  }

  function clearRange() {
    const api = apiRef.current
    if (!api) return
    api.playbackRange = null
    api.clearPlaybackRangeHighlight()
    setRange(false)
  }

  function toggleMetronome() {
    setMetronome(!metronome)
    if (apiRef.current) apiRef.current.metronomeVolume = metronome ? 0 : 1
  }

  function toggleCountIn() {
    setCountIn(!countIn)
    if (apiRef.current) apiRef.current.countInVolume = countIn ? 0 : 1
  }

  return (
    <div className="score">
      <div ref={scrollRef} className="score-scroll" role="document" aria-label={title} tabIndex={-1}>
        {failed ? (
          <p className="stage-error" role="alert">
            Cette tablature ne peut pas être affichée.
            <span>Le fichier est peut-être absent, abîmé, ou d'une version de Guitar Pro non prise en charge.</span>
          </p>
        ) : (
          <div ref={sheetRef} className="score-sheet" />
        )}
      </div>

      <div className="pedal score-pedal">
        <div className="deck">
          <div className="knob" role="group" aria-label="Lecture">
            <span className="silk">{ready ? 'Lecture' : 'Chargement du son…'}</span>
            <div className="keys keys-fader">
              <button
                type="button"
                className="foot"
                disabled={!ready}
                onClick={() => apiRef.current?.playPause()}
                aria-label={playing ? 'Mettre en pause' : 'Lire la tablature'}
                title="Lecture / pause (Espace)"
              >
                <Icon name={playing ? 'pause' : 'play'} />
              </button>
              <span className="clock score-clock" aria-hidden="true">
                <b>{formatTime(time.current)}</b>
                <span>/ {formatTime(time.end)}</span>
              </span>
            </div>
          </div>

          <div className="knob" role="group" aria-label="Tempo de lecture">
            <span className="silk" title="Le tempo du début du morceau : les changements de tempo suivent">
              Tempo
            </span>
            <div className="keys">
              <button
                type="button"
                className="sw sw-icon"
                disabled={bpm === null || bpm <= MIN_BPM}
                onClick={() => bpm !== null && changeBpm(bpm - BPM_STEP)}
                aria-label="Ralentir"
              >
                −
              </button>
              <label className="sw score-bpm">
                <input
                  inputMode="numeric"
                  maxLength={3}
                  disabled={bpm === null}
                  value={draft ?? (bpm === null ? '' : String(bpm))}
                  aria-label={`Tempo en battements par minute, de ${MIN_BPM} à ${MAX_BPM}`}
                  title="Tapez un tempo, puis Entrée"
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
                  onBlur={commitDraft}
                  onKeyDown={(event) => {
                    // Le focus revient à la partition : Espace la lance aussitôt.
                    if (event.key === 'Enter') scrollRef.current?.focus()
                    if (event.key === 'Escape') {
                      // Annule la saisie, sans quitter la partition.
                      event.preventDefault()
                      event.stopPropagation()
                      cancelled.current = true
                      scrollRef.current?.focus()
                    }
                  }}
                />
                BPM
              </label>
              <button
                type="button"
                className="sw sw-icon"
                disabled={bpm === null || bpm >= MAX_BPM}
                onClick={() => bpm !== null && changeBpm(bpm + BPM_STEP)}
                aria-label="Accélérer"
              >
                +
              </button>
              <button
                type="button"
                className="sw"
                aria-pressed={bpm !== null && bpm === original}
                disabled={original === null}
                onClick={() => original !== null && changeBpm(original)}
                title="Revenir au tempo du morceau"
              >
                Original{original !== null && ` · ${original}`}
              </button>
            </div>
          </div>

          <div className="knob" role="group" aria-label="Boucle">
            <span className="silk" title="Glissez sur la partition pour choisir les mesures à boucler">
              Boucle {range ? '· mesures choisies' : '· tout le morceau'}
              <i className="led" data-on={looping ? 'true' : undefined} />
            </span>
            <div className="keys">
              <button type="button" className="sw sw-live" aria-pressed={looping} onClick={toggleLoop}>
                Boucler
              </button>
              <button
                type="button"
                className="sw sw-icon"
                disabled={!range}
                onClick={clearRange}
                aria-label="Effacer la sélection"
                title="Effacer la sélection : tout le morceau est joué"
              >
                <Icon name="close" />
              </button>
            </div>
          </div>

          <div className="knob" role="group" aria-label="Clic">
            <span className="silk">Clic</span>
            <div className="keys">
              <button type="button" className="sw" aria-pressed={metronome} onClick={toggleMetronome}>
                Métronome
              </button>
              <button
                type="button"
                className="sw"
                aria-pressed={countIn}
                onClick={toggleCountIn}
                title="Une mesure de clic avant de jouer"
              >
                Décompte
              </button>
            </div>
          </div>

          {tracks.length > 1 && (
            <label className="knob">
              <span className="silk">Piste</span>
              <span className="method-picker score-track">
                <select value={track} onChange={(event) => showTrack(Number(event.target.value))}>
                  {tracks.map((item, index) => (
                    <option key={item.index} value={index}>
                      {item.name || `Piste ${index + 1}`}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" />
              </span>
            </label>
          )}

          <div className="knob knob-end">
            <span className="silk">{back.group}</span>
            <div className="keys">
              <button type="button" className="sw" onClick={onClose}>
                <Icon name={back.icon} />
                {back.label}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
