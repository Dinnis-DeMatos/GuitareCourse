/** Jours qui restent avant Noël (0 le 25 décembre) ; passé Noël, on compte vers celui de l'an prochain. */
export function daysUntilChristmas(now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let christmas = new Date(today.getFullYear(), 11, 25)
  if (today > christmas) christmas = new Date(today.getFullYear() + 1, 11, 25)
  // Arrondi : un passage à l'heure d'hiver ou d'été fait une journée de 23 ou 25 heures.
  return Math.round((christmas.getTime() - today.getTime()) / 86_400_000)
}
