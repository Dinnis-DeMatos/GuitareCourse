import type { CSSProperties } from 'react'
import type { ProgressMap } from '../courseTypes.ts'
import { STAGES, stageIndex } from '../streak.ts'
import { MascotArt } from './MascotArt.tsx'
import { useStreak } from './useStreak.ts'

const plural = (n: number) => (n > 1 ? 'jours' : 'jour')

/** Les niveaux à gagner : un par case du manche (le sommeil n'en est pas un). */
const LEVELS = STAGES.slice(1)

/** La mascotte de l'accueil sur sa petite scène, et le manche de ses niveaux. */
export function Mascot({ progress }: { progress: ProgressMap }) {
  const { streak, failed } = useStreak(progress)
  if (!streak)
    return (
      <section className="mascot" aria-label="Série de jours de pratique">
        {failed && <p className="mascot-status">La série n'a pas pu être lue.</p>}
      </section>
    )

  const { days, today } = streak
  const stage = stageIndex(days)
  const { name, from } = STAGES[stage]
  const next = STAGES.at(stage + 1)
  const left = next ? next.from - days : 0
  // En cases : celles des niveaux gagnés, plus le chemin fait vers le suivant.
  const played = next ? stage + (days - from) / (next.from - from) : LEVELS.length
  const status = today
    ? "C'est joué pour aujourd'hui."
    : days > 0
      ? "Jouez aujourd'hui pour garder la série."
      : "Une leçon, une routine ou le manche, et il s'éveille."

  return (
    <section
      className="mascot"
      aria-labelledby="mascot-title"
      data-today={today || undefined}
      data-asleep={days === 0 || undefined}
    >
      <header className="mascot-head">
        <h2 id="mascot-title" className="silk">
          {name}
        </h2>
        <p className="silk">
          Niveau {stage}/{LEVELS.length}
        </p>
      </header>
      <div className="mascot-scene">
        {/* key : il rebondit quand il change de forme ou qu'on vient de jouer. */}
        <MascotArt key={`${stage}${today}`} stage={stage} happy={today} />
        <p className="mascot-count">
          <b>{days}</b>
          <span>{plural(days)} d'affilée</span>
        </p>
      </div>
      <p className="mascot-status">{status}</p>
      <div className="mascot-next">
        <div className="mascot-neck" aria-hidden="true" style={{ '--p': played / LEVELS.length } as CSSProperties}>
          {LEVELS.map((level, i) => (
            <span key={level.from} className="mascot-fret" data-won={i < stage || undefined} />
          ))}
        </div>
        <p>{next ? `${next.name} dans ${left} ${plural(left)}` : 'Forme ultime atteinte'}</p>
      </div>
    </section>
  )
}
