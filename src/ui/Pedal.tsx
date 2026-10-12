import type { CSSProperties, RefObject } from 'react'
import type { Bookmark } from '../courseTypes.ts'
import { RATES, rateLabel } from '../player/rates.ts'
import { hasRegion, type Loop } from '../player/useLoop.ts'
import { useMediaFlags, useMediaSeconds } from '../player/useMedia.ts'
import { formatTime } from '../progress.ts'
import { Icon } from './Icon.tsx'
import { Staff } from './Staff.tsx'

export interface Sound {
  /** De 0 à 1. */
  volume: number
  muted: boolean
}

/** « 03:12 » : les minutes sur deux chiffres, comme un compteur. */
function clockTime(seconds: number): string {
  const text = formatTime(seconds)
  return text.length === 4 ? `0${text}` : text
}

/** Compteur au bout de la portée : seul élément redessiné chaque seconde. */
function Clock({ videoRef, duration }: { videoRef: RefObject<HTMLVideoElement | null>; duration: number }) {
  const seconds = useMediaSeconds(videoRef)
  return (
    <div className="clock" aria-hidden="true">
      <b>{clockTime(seconds)}</b>
      <span>/ {clockTime(duration)}</span>
    </div>
  )
}

/**
 * Les commandes du lecteur, alignées sous la vidéo comme un pédalier : la portée qui sert de barre de
 * lecture, puis les touches, rangées par groupes sous leur légende.
 */
export function Pedal({
  videoRef,
  loop,
  marks,
  rate,
  sound,
  fullscreen,
  onTogglePlay,
  onSeek,
  onRate,
  onLoopStart,
  onLoopEnd,
  onLoopToggle,
  onLoopClear,
  onLoopKeep,
  onAddMark,
  onMark,
  onSound,
  onToggleMute,
  onToggleFullscreen,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  loop: Loop
  marks: Bookmark[]
  rate: number
  sound: Sound
  fullscreen: boolean
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onRate: (rate: number) => void
  onLoopStart: () => void
  onLoopEnd: () => void
  onLoopToggle: () => void
  onLoopClear: () => void
  /** Garde la boucle actuelle comme repère. */
  onLoopKeep: () => void
  onAddMark: () => void
  onMark: (mark: Bookmark) => void
  onSound: (sound: Sound) => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
}) {
  const flags = useMediaFlags(videoRef)
  const region = hasRegion(loop)
  const level = sound.muted ? 0 : Math.round(sound.volume * 100)

  return (
    <div className="pedal">
      <div className="window">
        <button
          type="button"
          className="foot"
          onClick={onTogglePlay}
          aria-label={flags.paused ? 'Lire' : 'Mettre en pause'}
          title="Lecture / pause (Espace)"
        >
          <Icon name={flags.paused ? 'play' : 'pause'} />
        </button>
        <div className="clef" aria-hidden="true">
          <span>T</span>
          <span>A</span>
          <span>B</span>
        </div>
        <Staff
          videoRef={videoRef}
          duration={flags.duration}
          loop={loop}
          marks={marks}
          onSeek={onSeek}
          onMark={onMark}
        />
        <Clock videoRef={videoRef} duration={flags.duration} />
      </div>

      <div className="deck">
        <div className="knob" role="group" aria-label="Vitesse de lecture">
          <span className="silk">Vitesse</span>
          <div className="keys">
            {RATES.map((value) => (
              <button
                key={value}
                type="button"
                className="sw"
                aria-pressed={rate === value}
                aria-label={`Vitesse ${rateLabel(value)}`}
                onClick={() => onRate(value)}
              >
                {rateLabel(value)}
              </button>
            ))}
          </div>
        </div>

        <div className="knob" role="group" aria-label="Boucle">
          <span className="silk">
            Boucle
            <i className="led" data-on={loop.active && region ? 'true' : undefined} />
          </span>
          <div className="keys">
            <button
              type="button"
              className="sw"
              onClick={onLoopStart}
              title="Placer le début de la boucle à cet instant (A)"
              aria-label={`Début de la boucle${loop.start !== null ? ` : ${formatTime(loop.start)}` : ''}`}
            >
              <Icon name="repeatStart" className="sign" />
              <span className="t">{loop.start !== null ? formatTime(loop.start) : '-:--'}</span>
            </button>
            <button
              type="button"
              className="sw"
              onClick={onLoopEnd}
              title="Placer la fin de la boucle à cet instant (B)"
              aria-label={`Fin de la boucle${loop.end !== null ? ` : ${formatTime(loop.end)}` : ''}`}
            >
              <span className="t">{loop.end !== null ? formatTime(loop.end) : '-:--'}</span>
              <Icon name="repeatEnd" className="sign" />
            </button>
            <button
              type="button"
              className="sw sw-live"
              aria-pressed={loop.active && region}
              disabled={!region}
              onClick={onLoopToggle}
              title="Activer ou arrêter la boucle (L)"
            >
              Boucler
            </button>
            <button
              type="button"
              className="sw"
              disabled={!region}
              onClick={onLoopKeep}
              title="Garder ce passage comme repère, pour y revenir plus tard"
            >
              Garder
            </button>
            <button
              type="button"
              className="sw sw-icon"
              disabled={loop.start === null && loop.end === null}
              onClick={onLoopClear}
              aria-label="Effacer la boucle"
              title="Effacer la boucle"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        <div className="knob">
          <span className="silk">Repère</span>
          <div className="keys">
            <button type="button" className="sw" onClick={onAddMark} title="Poser un repère à cet instant (R)">
              <Icon name="plus" />
              Poser
            </button>
          </div>
        </div>

        <div className="knob knob-end" role="group" aria-label="Son">
          <span className="silk">Volume</span>
          <div className="keys keys-fader">
            <button
              type="button"
              className="sw sw-icon"
              aria-pressed={sound.muted}
              onClick={onToggleMute}
              aria-label={sound.muted ? 'Remettre le son' : 'Couper le son'}
              title="Couper / remettre le son (M)"
            >
              <Icon name={level === 0 ? 'mute' : 'volume'} />
            </button>
            <input
              type="range"
              className="fader"
              min={0}
              max={100}
              value={level}
              aria-label="Volume"
              style={{ '--v': `${level}%` } as CSSProperties}
              onChange={(event) => {
                const volume = Number(event.target.value) / 100
                onSound({ volume, muted: volume === 0 })
              }}
            />
          </div>
        </div>

        <div className="knob">
          <span className="silk">Écran</span>
          <div className="keys">
            <button
              type="button"
              className="sw sw-icon"
              onClick={onToggleFullscreen}
              aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              title="Plein écran (F)"
            >
              <Icon name={fullscreen ? 'fullscreenExit' : 'fullscreen'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
