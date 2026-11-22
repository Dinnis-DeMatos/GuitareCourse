import { useEffect, useState, type CSSProperties } from 'react'
import type { ProgressMap } from '../courseTypes.ts'
import { stageIndex } from '../streak.ts'
import { MascotArt } from './MascotArt.tsx'
import { useStreak } from './useStreak.ts'

/** Durée de l'ouverture : la chute, le rebond, la métamorphose, l'accord, la marque (intro.css). */
const PLAY_MS = 2900
/** Le rideau qui s'ouvre en médiator. */
const LEAVE_MS = 650

/** La corde du haut, où il atterrit, et l'écart entre deux cordes, dans les unités de la scène (600 × 310). */
const TOP_STRING = 236
const STRING_GAP = 12

const WORD = [...'GuitareCourse']
/** Là où « Course », en maigre, commence. */
const LIGHT_FROM = 'Guitare'.length

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * L'ouverture de l'application, une fois par lancement : le médiator du logo tombe sur six cordes, qui
 * plient et le renvoient en l'air ; il y devient la mascotte, à sa forme du moment (réveillée, même si la
 * série est perdue), retombe et fait sonner l'accord qui pose « GuitareCourse ». Elle attend que les cours
 * soient lus (`ready`), puis le rideau s'ouvre en forme de médiator ; un clic ou une touche l'abrège. Sans
 * animation si Windows les réduit.
 * `onLeave` : le rideau commence à s'ouvrir (l'accueil se dévoile) ; `onDone` : il a disparu.
 */
export function Intro({
  ready,
  progress,
  onLeave,
  onDone,
}: {
  ready: boolean
  progress: ProgressMap | null
  onLeave: () => void
  onDone: () => void
}) {
  const [played, setPlayed] = useState(reducedMotion)
  const [leaving, setLeaving] = useState(false)
  const { streak } = useStreak(progress)

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
        <svg className="intro-scene" viewBox="0 0 600 310">
          <path className="intro-sound" d="M196 100q-36 56 0 112M404 100q36 56 0 112" />
          <path className="intro-sound" d="M156 80q-50 76 0 152M444 80q50 76 0 152" />
          {Array.from({ length: 6 }, (_, i) => {
            const y = TOP_STRING + i * STRING_GAP
            return (
              <g key={i} className="intro-string" style={{ '--i': i, '--y': `${y}px` } as CSSProperties}>
                <g className="intro-ring">
                  {/* Deux moitiés : pressée en son milieu, une corde fait un V. */}
                  <path className="intro-half" d={`M0 ${y}H300`} />
                  <path className="intro-half intro-half-right" d={`M300 ${y}H600`} />
                </g>
              </g>
            )
          })}
          <path className="intro-burst" d="M300 88V58M356 108L377 87M378 164H408M356 220L377 241M244 220L223 241M222 164H192M244 108L223 87" />
        </svg>

        <div className="intro-actor">
          <div className="intro-squash">
            <div className="intro-flip">
              <svg className="intro-logo" viewBox="0 0 200 196">
                <g transform="translate(100 188) scale(5.6) translate(-12 -22.6)">
                  <path d="M12 22.6c-2 0-9.6-10.4-9.6-15C2.4 3.7 6.4 1.6 12 1.6s9.6 2.1 9.6 6c0 4.6-7.6 15-9.6 15Z" />
                  <path className="intro-logo-play" d="M9.4 6.4 16 10.2l-6.6 3.8Z" />
                </g>
              </svg>
              <div className="intro-mascot">
                <MascotArt stage={Math.max(1, stageIndex(streak?.days ?? 0))} happy />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="intro-word">
        {WORD.map((letter, i) => (
          <span key={i} className={i < LIGHT_FROM ? undefined : 'intro-light'} style={{ '--i': i } as CSSProperties}>
            {letter}
          </span>
        ))}
      </p>
    </div>
  )
}
