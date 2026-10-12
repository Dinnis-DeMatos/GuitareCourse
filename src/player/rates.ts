/** Vitesses de lecture proposées, de la plus lente à la plus rapide. */
export const RATES = [0.5, 0.75, 1, 1.25] as const

/** « 0,75 » : la vitesse écrite à la française. */
export function rateLabel(rate: number): string {
  return String(rate).replace('.', ',')
}

/** Vitesse voisine dans la liste (−1 : plus lente, +1 : plus rapide), sans dépasser les extrêmes. */
export function stepRate(rate: number, direction: -1 | 1): number {
  const index = RATES.findIndex((value) => value === rate)
  const from = index === -1 ? RATES.indexOf(1) : index
  return RATES[Math.min(RATES.length - 1, Math.max(0, from + direction))]
}
