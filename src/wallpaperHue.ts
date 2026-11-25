/**
 * La teinte dominante d'un fond d'écran, en degrés OKLCH : celle des pixels les plus colorés, pondérée par
 * leur intensité. Les gris, le noir et le blanc ne comptent pas. null si l'image n'a pas de couleur franche.
 */
export function dominantHue(rgba: Uint8ClampedArray): number | null {
  const BINS = 36
  const weights = new Array<number>(BINS).fill(0)
  const sums = Array.from({ length: BINS }, () => ({ x: 0, y: 0 }))
  for (let i = 0; i < rgba.length; i += 4) {
    const [L, a, b] = oklab(rgba[i], rgba[i + 1], rgba[i + 2])
    const chroma = Math.hypot(a, b)
    // Trop terne ou trop sombre pour donner une couleur.
    if (chroma < 0.04 || L < 0.25) continue
    const hue = Math.atan2(b, a)
    const bin = Math.floor(((hue / (2 * Math.PI) + 1) % 1) * BINS) % BINS
    weights[bin] += chroma
    sums[bin].x += Math.cos(hue) * chroma
    sums[bin].y += Math.sin(hue) * chroma
  }
  const best = weights.indexOf(Math.max(...weights))
  if (weights[best] === 0) return null
  // Moyenne circulaire de la case la plus forte et de ses voisines.
  let x = 0
  let y = 0
  for (const bin of [best - 1, best, best + 1]) {
    const s = sums[(bin + BINS) % BINS]
    x += s.x
    y += s.y
  }
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
}

/** sRGB (0-255) vers OKLab. */
function oklab(r8: number, g8: number, b8: number): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [lin(r8), lin(g8), lin(b8)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817103208 * g + 0.6299787162 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
