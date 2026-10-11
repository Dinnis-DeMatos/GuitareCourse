import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Bookmark } from './courseTypes.ts'
import { formatTime } from './progress.ts'
import { isTypingTarget, resolveShortcut, SEEK_SECONDS, type ShortcutAction } from './shortcuts.ts'

const RATES = [0.5, 0.75, 1, 1.25] as const

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function rateLabel(rate: number): string {
  return `${String(rate).replace('.', ',')}×`
}

/** Les commandes natives (Entrée, Espace) d'un bouton ou lien atteint au clavier restent à lui. */
function isKeyboardFocusedControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.matches('button, a[href], summary, [role="button"]') &&
    target.matches(':focus-visible')
  )
}

/**
 * Outils d'entraînement sous la vidéo : vitesse, boucle sur un passage (A → B) et repères.
 * Un repère est un instant ; un repère avec une fin est un passage qui repart en boucle.
 * Rassemble aussi les raccourcis clavier, qui agissent sur les mêmes commandes que les boutons.
 */
export function Practice({
  videoRef,
  rate,
  onRateChange,
  bookmarks,
  onBookmarksChange,
  onNext,
  onPrevious,
  onHelp,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  rate: number
  onRateChange: (rate: number) => void
  bookmarks: Bookmark[]
  onBookmarksChange: (bookmarks: Bookmark[]) => void
  /** Leçon suivante / précédente ; null s'il n'y en a pas. */
  onNext: (() => void) | null
  onPrevious: (() => void) | null
  onHelp: () => void
}) {
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)
  const [looping, setLooping] = useState(false)
  const [flash, setFlash] = useState('')
  const hasLoop = loopStart !== null && loopEnd !== null && loopEnd > loopStart

  // Petit message qui confirme l'effet d'un raccourci (la vidéo, elle, ne change pas d'apparence).
  const flashTimer = useRef<number | undefined>(undefined)
  const say = useCallback((message: string) => {
    setFlash(message)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(''), 1600)
  }, [])
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

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
    say(`Début de la boucle : ${formatTime(time)}`)
  }

  function markEnd() {
    const time = now()
    const start = loopStart ?? 0
    if (loopStart === null) setLoopStart(0)
    if (time <= start) {
      say('La fin doit être après le début')
      return
    }
    setLoopEnd(time)
    setLooping(true)
    say(`Boucle ${formatTime(start)} → ${formatTime(time)}`)
  }

  function toggleLoop() {
    if (!hasLoop) {
      say('Placez d\'abord le début (A) et la fin (B)')
      return
    }
    setLooping(!looping)
    say(looping ? 'Boucle arrêtée' : 'Boucle active')
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
    say(`Repère ajouté à ${formatTime(bookmark.time)}`)
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

  // Vitesse courante, tenue à jour tout de suite : deux appuis très rapprochés ne doivent pas lire
  // l'ancienne valeur avant que le rendu n'ait eu lieu.
  const currentRate = useRef(rate)
  useEffect(() => {
    currentRate.current = rate
  }, [rate])

  function changeRate(direction: -1 | 1) {
    const index = RATES.findIndex((value) => value === currentRate.current)
    const next = RATES[Math.min(RATES.length - 1, Math.max(0, index + direction))]
    currentRate.current = next
    onRateChange(next)
    say(`Vitesse ${rateLabel(next)}`)
  }

  /** Exécute l'action d'un raccourci. */
  function perform(action: ShortcutAction) {
    const video = videoRef.current
    switch (action) {
      case 'playPause':
        if (video) {
          if (video.paused) video.play().catch(() => undefined)
          else video.pause()
        }
        break
      case 'back':
      case 'forward':
        if (video) {
          const delta = action === 'back' ? -SEEK_SECONDS : SEEK_SECONDS
          const limit = Number.isFinite(video.duration) ? video.duration : Infinity
          video.currentTime = Math.min(limit, Math.max(0, video.currentTime + delta))
          say(`${delta > 0 ? '+' : '−'}${SEEK_SECONDS} s`)
        }
        break
      case 'mute':
        if (video) {
          video.muted = !video.muted
          say(video.muted ? 'Son coupé' : 'Son remis')
        }
        break
      case 'fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen()
        else void video?.requestFullscreen?.()
        break
      case 'loopStart':
        markStart()
        break
      case 'loopEnd':
        markEnd()
        break
      case 'loopToggle':
        toggleLoop()
        break
      case 'bookmark':
        addBookmark({ time: now() })
        break
      case 'slower':
        changeRate(-1)
        break
      case 'faster':
        changeRate(1)
        break
      case 'next':
        if (onNext) onNext()
        else say('C\'est la dernière leçon')
        break
      case 'previous':
        if (onPrevious) onPrevious()
        else say('C\'est la première leçon')
        break
      case 'help':
        onHelp()
        break
    }
  }

  // Le gestionnaire clavier est posé une seule fois : il passe par cette ref pour toujours appeler
  // la version de `perform` du dernier rendu (et donc voir l'état courant de la boucle, des repères…).
  const run = useRef<(action: ShortcutAction) => void>(() => undefined)
  useEffect(() => {
    run.current = perform
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      // Une touche maintenue ne répète que les flèches (reculer / avancer en continu).
      if (event.repeat && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const action = resolveShortcut(event)
      if (!action) return
      const target = event.target
      if (isTypingTarget(target)) return
      if (target instanceof Element && target.closest('dialog')) return
      // Espace sur un bouton atteint au clavier : c'est le bouton qui doit s'activer.
      if (action === 'playPause' && event.key === ' ' && isKeyboardFocusedControl(target)) return
      // On empêche aussi la commande native des contrôles de la vidéo, sinon elle agirait en double.
      event.preventDefault()
      run.current(action)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

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
          <button type="button" onClick={markStart} title="Placer le début de la boucle à l'instant actuel (A)">
            Début{loopStart !== null ? ` ${formatTime(loopStart)}` : ''}
          </button>
          <button type="button" onClick={markEnd} title="Placer la fin de la boucle à l'instant actuel (B)">
            Fin{loopEnd !== null ? ` ${formatTime(loopEnd)}` : ''}
          </button>
          <button
            type="button"
            aria-pressed={looping && hasLoop}
            disabled={!hasLoop}
            onClick={toggleLoop}
            title="Activer ou arrêter la boucle (L)"
          >
            {looping && hasLoop ? 'Boucle active' : 'Boucler'}
          </button>
          <button type="button" disabled={loopStart === null && loopEnd === null} onClick={clearLoop}>
            Effacer
          </button>
        </div>

        <span className="flash" role="status" aria-live="polite">
          {flash}
        </span>
      </div>

      <div className="bookmarks">
        <div className="bookmarks-head">
          <h3>Repères{bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}</h3>
          <button type="button" onClick={() => addBookmark({ time: now() })} title="Ajouter un repère (R)">
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
