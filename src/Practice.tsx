import { useEffect, useState, type RefObject } from 'react'
import type { Bookmark } from './courseTypes.ts'
import { formatTime } from './progress.ts'

const RATES = [0.5, 0.75, 1, 1.25] as const

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function rateLabel(rate: number): string {
  return `${String(rate).replace('.', ',')}×`
}

/**
 * Outils d'entraînement sous la vidéo : vitesse, boucle sur un passage (A → B) et repères.
 * Un repère est un instant ; un repère avec une fin est un passage qui repart en boucle.
 */
export function Practice({
  videoRef,
  rate,
  onRateChange,
  bookmarks,
  onBookmarksChange,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  rate: number
  onRateChange: (rate: number) => void
  bookmarks: Bookmark[]
  onBookmarksChange: (bookmarks: Bookmark[]) => void
}) {
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)
  const [looping, setLooping] = useState(false)
  const hasLoop = loopStart !== null && loopEnd !== null && loopEnd > loopStart

  // Boucle : on surveille la lecture toutes les 20 ms (« timeupdate » est trop lent : ~4 fois par
  // seconde, la fin serait dépassée de plusieurs dixièmes). Un minuteur, plutôt que
  // requestAnimationFrame, continue de tourner quand l'onglet n'est pas au premier plan.
  useEffect(() => {
    if (!looping || !hasLoop) return
    const video = videoRef.current
    if (!video) return
    const timer = window.setInterval(() => {
      if (!video.paused && (video.currentTime >= loopEnd || video.currentTime < loopStart)) {
        video.currentTime = loopStart
      }
    }, 20)
    return () => window.clearInterval(timer)
  }, [looping, hasLoop, loopStart, loopEnd, videoRef])

  const now = () => videoRef.current?.currentTime ?? 0

  function markStart() {
    const time = now()
    setLoopStart(time)
    if (loopEnd !== null && loopEnd <= time) {
      setLoopEnd(null)
      setLooping(false)
    }
  }

  function markEnd() {
    const time = now()
    const start = loopStart ?? 0
    if (loopStart === null) setLoopStart(0)
    if (time <= start) return
    setLoopEnd(time)
    setLooping(true)
  }

  function clearLoop() {
    setLoopStart(null)
    setLoopEnd(null)
    setLooping(false)
  }

  function addBookmark(bookmark: Omit<Bookmark, 'id' | 'label'>) {
    onBookmarksChange(
      [...bookmarks, { ...bookmark, id: newId(), label: '' }].sort((a, b) => a.time - b.time),
    )
  }

  function goTo(bookmark: Bookmark) {
    const video = videoRef.current
    if (!video) return
    if (bookmark.end !== undefined) {
      setLoopStart(bookmark.time)
      setLoopEnd(bookmark.end)
      setLooping(true)
    }
    video.currentTime = bookmark.time
    video.play().catch(() => undefined)
  }

  return (
    <section className="practice" aria-label="Entraînement">
      <div className="practice-row">
        <span className="practice-label">Vitesse</span>
        <div className="segmented" role="group" aria-label="Vitesse de lecture">
          {RATES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rate === value}
              onClick={() => onRateChange(value)}
            >
              {rateLabel(value)}
            </button>
          ))}
        </div>

        <span className="practice-label">Boucle</span>
        <div className="loop-controls">
          <button type="button" onClick={markStart} title="Placer le début de la boucle à l'instant actuel">
            Début{loopStart !== null ? ` ${formatTime(loopStart)}` : ''}
          </button>
          <button type="button" onClick={markEnd} title="Placer la fin de la boucle à l'instant actuel">
            Fin{loopEnd !== null ? ` ${formatTime(loopEnd)}` : ''}
          </button>
          <button
            type="button"
            aria-pressed={looping && hasLoop}
            disabled={!hasLoop}
            onClick={() => setLooping((value) => !value)}
          >
            {looping && hasLoop ? 'Boucle active' : 'Boucler'}
          </button>
          <button type="button" disabled={loopStart === null && loopEnd === null} onClick={clearLoop}>
            Effacer
          </button>
        </div>
      </div>

      <div className="bookmarks">
        <div className="bookmarks-head">
          <h3>Repères{bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}</h3>
          <button type="button" onClick={() => addBookmark({ time: now() })}>
            + Repère à cet instant
          </button>
          {hasLoop && (
            <button type="button" onClick={() => addBookmark({ time: loopStart, end: loopEnd })}>
              + Enregistrer la boucle {formatTime(loopStart)} → {formatTime(loopEnd)}
            </button>
          )}
        </div>
        {bookmarks.length > 0 && (
          <ul className="bookmark-list">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id}>
                <button
                  type="button"
                  className="bookmark-go"
                  onClick={() => goTo(bookmark)}
                  title={bookmark.end !== undefined ? 'Lire ce passage en boucle' : 'Lire à partir de ce repère'}
                >
                  ▶ {formatTime(bookmark.time)}
                  {bookmark.end !== undefined ? ` → ${formatTime(bookmark.end)}` : ''}
                </button>
                <input
                  type="text"
                  className="bookmark-label"
                  aria-label={`Nom du repère à ${formatTime(bookmark.time)}`}
                  placeholder="Nom du repère"
                  maxLength={200}
                  value={bookmark.label}
                  onChange={(event) =>
                    onBookmarksChange(
                      bookmarks.map((b) => (b.id === bookmark.id ? { ...b, label: event.target.value } : b)),
                    )
                  }
                />
                <button
                  type="button"
                  className="bookmark-delete"
                  aria-label={`Supprimer le repère à ${formatTime(bookmark.time)}`}
                  title="Supprimer"
                  onClick={() => onBookmarksChange(bookmarks.filter((b) => b.id !== bookmark.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
