import { daysUntilChristmas } from '../season.ts'

/**
 * La case du calendrier de l'Avent, à côté de la marque : le nombre de jours avant Noël derrière une
 * petite porte prédécoupée. Toujours rendue, elle n'est affichée qu'avec le thème des fêtes (season.css).
 * shortcut: le compte est pris au rendu ; laissée ouverte sans interaction passé minuit, la case garde la veille.
 */
export function Advent() {
  const days = daysUntilChristmas(new Date())
  const label = days === 0 ? 'Joyeux Noël' : `${days} jour${days > 1 ? 's' : ''} avant Noël`
  return (
    <span className="advent" title={label} aria-label={label} role="img">
      <span className="advent-door">{days === 0 ? '25' : days}</span>
      <span className="advent-text" aria-hidden="true">
        {days === 0 ? (
          <>
            Joyeux
            <br />
            Noël
          </>
        ) : (
          <>
            {days > 1 ? 'jours' : 'jour'}
            <br />
            avant Noël
          </>
        )}
      </span>
    </span>
  )
}
