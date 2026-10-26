import { useEffect, useState, type CSSProperties } from 'react'

/** Durée de l'ouverture : les cordes se tendent, le médiator les gratte, la marque apparaît. */
const PLAY_MS = 1700
/** Le rideau qui s'efface. */
const LEAVE_MS = 450

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * L'ouverture de l'application, une fois par lancement : six cordes tendues l'une après l'autre, un
 * coup de médiator qui les fait vibrer, puis « GuitareCourse ». Elle attend que les cours soient lus
 * (`ready`) avant de s'effacer ; un clic ou une touche l'abrège. Sans animation si Windows les réduit.
 * `onLeave` : le rideau commence à s'effacer (l'accueil se dévoile) ; `onDone` : il a disparu.
 */
export function Intro({ ready, onLeave, onDone }: { ready: boolean; onLeave: () => void; onDone: () => void }) {
  const [played, setPlayed] = useState(reducedMotion)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (played) return
    const timer = window.setTimeout(() => setPlayed(true), PLAY_MS)
    const skip = () => setPlayed(true)
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [played])

  useEffect(() => {
    if (!played || !ready) return
    setLeaving(true)
    onLeave()
    const timer = window.setTimeout(onDone, reducedMotion() ? 0 : LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [played, ready, onLeave, onDone])

  return (
    <div className="intro" data-leaving={leaving || undefined} aria-hidden="true">
      <div className="intro-stage">
        <div className="intro-strings">
          {Array.from({ length: 6 }, (_, string) => (
            <i key={string} style={{ '--i': string } as CSSProperties} />
          ))}
        </div>
        <svg className="intro-pick" viewBox="0 0 24 24">
          <path d="M12 22.6c-2 0-9.6-10.4-9.6-15C2.4 3.7 6.4 1.6 12 1.6s9.6 2.1 9.6 6c0 4.6-7.6 15-9.6 15Z" />
        </svg>
      </div>
      <p className="intro-word">
        Guitare<span>Course</span>
      </p>
    </div>
  )
}
