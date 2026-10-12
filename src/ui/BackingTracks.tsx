import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { CourseFile } from '../courseTypes.ts'
import { mediaUrl } from '../media.ts'
import { useMediaFlags, useMediaSeconds } from '../player/useMedia.ts'
import { usePlayhead } from '../player/usePlayhead.ts'
import { useScrub } from '../player/useScrub.ts'
import { formatTime } from '../progress.ts'
import { groupBackingTracks } from '../tempo.ts'
import { usePersistentState } from '../usePersistentState.ts'
import { Icon } from './Icon.tsx'
import { SectionHead } from './SectionHead.tsx'

/** Morceau chargé dans la platine. */
interface Loaded {
  file: CourseFile
  title: string
  bpm: number | null
}

const isRatio = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1

/** La position dans le morceau, sur une seule corde (la vidéo en a six). */
function StringBar({ audioRef, duration }: { audioRef: RefObject<HTMLAudioElement | null>; duration: number }) {
  const bar = useRef<HTMLDivElement>(null)
  usePlayhead(audioRef, bar)
  const { handlers } = useScrub(duration, (time) => {
    if (audioRef.current) audioRef.current.currentTime = time
  })
  return (
    <div
      ref={bar}
      className="string"
      role="slider"
      tabIndex={0}
      aria-label="Position dans le backing track"
      aria-orientation="horizontal"
      aria-valuemin={0}
      {...handlers}
    />
  )
}

/**
 * Les backing tracks d'une leçon. Un même morceau fourni à plusieurs tempos est présenté comme une
 * indication de tempo de partition (« noire = 80 · 90 · 110 ») ; une seule platine joue le morceau choisi.
 */
export function BackingTracks({ files }: { files: CourseFile[] }) {
  const items = useMemo(() => groupBackingTracks(files), [files])
  const audioRef = useRef<HTMLAudioElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const flags = useMediaFlags(audioRef)
  const seconds = useMediaSeconds(audioRef)
  const [volume, setVolume] = usePersistentState('guitarecourse.backing-volume', 1, isRatio)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const isLoaded = (file: CourseFile) => loaded?.file.path === file.path
  const isPlaying = (file: CourseFile) => isLoaded(file) && !flags.paused

  /** Lance un morceau ; s'il est déjà dans la platine, alterne lecture et pause. */
  function toggle(track: Loaded) {
    const audio = audioRef.current
    if (!audio) return
    if (isLoaded(track.file)) {
      if (audio.paused) audio.play().catch(() => undefined)
      else audio.pause()
      return
    }
    audio.src = mediaUrl(track.file)
    setLoaded(track)
    audio.play().catch(() => undefined)
  }

  return (
    <section className="backing" aria-labelledby="backing-title">
      <SectionHead id="backing-title" title="Backing tracks" count={files.length} />
      <ul className="bt-list">
        {items.map((item) =>
          item.kind === 'ladder' ? (
            <li key={item.tracks[0].file.path}>
              <p className="bt-title">{item.title}</p>
              <div className="tempo" role="group" aria-label={`Tempo de « ${item.title} »`}>
                <span className="tempo-eq" aria-hidden="true">
                  <Icon name="note" />=
                </span>
                {item.tracks.map((track) => (
                  <button
                    key={track.file.path}
                    type="button"
                    aria-pressed={isLoaded(track.file)}
                    aria-label={`${track.bpm} battements par minute`}
                    data-playing={isPlaying(track.file) ? 'true' : undefined}
                    onClick={() => toggle({ file: track.file, title: item.title, bpm: track.bpm })}
                  >
                    {track.bpm}
                  </button>
                ))}
                <em aria-hidden="true">bpm</em>
              </div>
            </li>
          ) : (
            <li key={item.file.path} className="bt-single">
              <button
                type="button"
                className="bt-play"
                aria-pressed={isLoaded(item.file)}
                aria-label={`${isPlaying(item.file) ? 'Mettre en pause' : 'Écouter'} « ${item.title} »`}
                onClick={() => toggle({ file: item.file, title: item.title, bpm: null })}
              >
                <Icon name={isPlaying(item.file) ? 'pause' : 'play'} />
              </button>
              <p className="bt-title">{item.title}</p>
            </li>
          ),
        )}
      </ul>

      {loaded && (
        <div className="tape">
          <button
            type="button"
            className="foot"
            onClick={() => toggle(loaded)}
            aria-label={flags.paused ? 'Lire le backing track' : 'Mettre le backing track en pause'}
          >
            <Icon name={flags.paused ? 'play' : 'pause'} />
          </button>
          <div className="tape-body">
            <p className="tape-title">
              <span>{loaded.title}</span>
              {loaded.bpm !== null && <em>{loaded.bpm} bpm</em>}
            </p>
            <StringBar audioRef={audioRef} duration={flags.duration} />
          </div>
          <time className="tape-time">
            {flags.failed ? 'illisible' : `${formatTime(seconds)} / ${formatTime(flags.duration)}`}
          </time>
          <label className="tape-volume">
            <Icon name="volume" />
            <input
              type="range"
              className="fader"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              aria-label="Volume du backing track"
              style={{ '--v': `${Math.round(volume * 100)}%` } as CSSProperties}
              onChange={(event) => setVolume(Number(event.target.value) / 100)}
            />
          </label>
        </div>
      )}
      <audio ref={audioRef} preload="none" />
    </section>
  )
}
