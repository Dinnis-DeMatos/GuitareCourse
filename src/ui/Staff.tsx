import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { Bookmark } from '../courseTypes.ts'
import { hasRegion, type Loop } from '../player/useLoop.ts'
import { usePlayhead } from '../player/usePlayhead.ts'
import { useScrub } from '../player/useScrub.ts'
import { formatTime } from '../progress.ts'
import { barLines, clampRatio, ratioOf } from '../staff.ts'
import { Icon } from './Icon.tsx'

/** Épaisseur des six cordes en pixels, de la chanterelle (en haut, comme sur une tablature) au mi grave. */
const STRINGS = [1, 1, 1.2, 1.5, 1.8, 2.1]

/**
 * La barre de lecture, dessinée comme une portée de tablature : six cordes qui se colorent à mesure
 * que la vidéo avance, des barres de mesure toutes les minutes, la boucle entre deux signes de
 * reprise et les repères numérotés au-dessus, comme les repères d'une partition. Les cordes vibrent
 * quand on les pince pour se déplacer, et quand la lecture démarre.
 */
export function Staff({
  videoRef,
  duration,
  loop,
  marks,
  onSeek,
  onMark,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  duration: number
  loop: Loop
  /** Repères triés par instant : leur rang (à partir de 1) est leur numéro. */
  marks: Bookmark[]
  onSeek: (time: number) => void
  onMark: (mark: Bookmark) => void
}) {
  const staff = useRef<HTMLDivElement>(null)
  usePlayhead(videoRef, staff)
  const { hover, handlers } = useScrub(duration, onSeek)
  const bars = useMemo(() => barLines(duration), [duration])
  // Cordes pincées : `count` relance la vibration, `at` est l'endroit du pincement (de 0 à 1).
  const [pluck, setPluck] = useState({ count: 0, at: 0.5 })

  // Lancer la lecture gratte les six cordes, là où se trouve la tête de lecture.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const strum = () =>
      setPluck((previous) => ({ count: previous.count + 1, at: ratioOf(video.currentTime, video.duration) }))
    video.addEventListener('play', strum)
    return () => video.removeEventListener('play', strum)
  }, [videoRef])

  const at = (time: number): CSSProperties => ({ left: `${ratioOf(time, duration) * 100}%` })
  const span = (start: number, end: number): CSSProperties => ({
    left: `${ratioOf(start, duration) * 100}%`,
    width: `${(ratioOf(end, duration) - ratioOf(start, duration)) * 100}%`,
  })

  return (
    <div className="staff-wrap">
      <div
        ref={staff}
        className="staff"
        role="slider"
        tabIndex={0}
        aria-label="Position dans la vidéo"
        aria-orientation="horizontal"
        aria-valuemin={0}
        {...handlers}
        onPointerDown={(event) => {
          handlers.onPointerDown(event)
          const box = event.currentTarget.getBoundingClientRect()
          const at = box.width > 0 ? clampRatio((event.clientX - box.left) / box.width) : 0.5
          setPluck((previous) => ({ count: previous.count + 1, at }))
        }}
        onKeyDown={(event) => {
          // Les flèches (±5 s) sont déjà des raccourcis de la page ; restent le début et la fin.
          if (event.key === 'Home') {
            event.preventDefault()
            onSeek(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            onSeek(duration)
          }
        }}
      >
        <div className="bars" aria-hidden="true">
          {bars.map((bar) => (
            <Fragment key={bar.time}>
              <i style={at(bar.time)} />
              <b style={at(bar.time)}>{bar.label}</b>
            </Fragment>
          ))}
        </div>
        {/* La clé recrée les cordes à chaque pincement : c'est ce qui relance leur vibration. */}
        <div
          key={pluck.count}
          className="strings"
          data-pluck={pluck.count > 0 ? 'true' : undefined}
          style={{ '--at': `${(pluck.at * 100).toFixed(1)}%` } as CSSProperties}
          aria-hidden="true"
        >
          {STRINGS.map((width, index) => (
            <i key={index} style={{ '--i': index, '--w': `${width}px` } as CSSProperties} />
          ))}
        </div>
        {hasRegion(loop) ? (
          <div className="loop" data-active={loop.active ? 'true' : undefined} style={span(loop.start, loop.end)}>
            <Icon name="repeatStart" />
            <Icon name="repeatEnd" />
          </div>
        ) : (
          loop.start !== null && (
            <div className="loop loop-open" style={at(loop.start)}>
              <Icon name="repeatStart" />
            </div>
          )
        )}
        <div className="head" aria-hidden="true" />
        {hover !== null && (
          <div className="tip" style={{ left: `${hover * 100}%` }} aria-hidden="true">
            {formatTime(hover * duration)}
          </div>
        )}
      </div>

      {/* Les repères sont posés par-dessus la portée, et non dedans : ce sont des boutons à part entière. */}
      <div className="staff-marks">
        {marks.map((mark, index) => {
          const name = mark.label || `Repère ${index + 1}`
          return mark.end === undefined ? (
            <button
              key={mark.id}
              type="button"
              className="flag"
              style={at(mark.time)}
              title={`${name} — ${formatTime(mark.time)}`}
              aria-label={`${name}, à ${formatTime(mark.time)} : lire à partir d'ici`}
              onClick={() => onMark(mark)}
            >
              <b>{index + 1}</b>
            </button>
          ) : (
            <button
              key={mark.id}
              type="button"
              className="volta"
              style={span(mark.time, mark.end)}
              title={`${name} — ${formatTime(mark.time)} à ${formatTime(mark.end)}`}
              aria-label={`${name}, de ${formatTime(mark.time)} à ${formatTime(mark.end)} : lire ce passage en boucle`}
              onClick={() => onMark(mark)}
            >
              {index + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
