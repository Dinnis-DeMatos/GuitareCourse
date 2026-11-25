import { describe, expect, it } from 'vitest'
import { dominantHue } from './wallpaperHue.ts'

/** Une image faite de `count` pixels de chaque couleur donnée. */
const image = (...parts: [number[], number][]) =>
  new Uint8ClampedArray(parts.flatMap(([rgb, count]) => Array.from({ length: count }, () => [...rgb, 255]).flat()))

describe('teinte dominante du fond d’écran', () => {
  it('donne la teinte OKLCH d’une couleur franche', () => {
    expect(dominantHue(image([[255, 0, 0], 10]))).toBeCloseTo(29, -1) // rouge
    expect(dominantHue(image([[0, 0, 255], 10]))).toBeCloseTo(264, -1) // bleu
  })
  it('ignore les gris, le noir et le blanc', () => {
    expect(dominantHue(image([[128, 128, 128], 500], [[0, 0, 0], 500], [[255, 255, 255], 500], [[0, 160, 0], 5]))).toBeCloseTo(142, -1)
    expect(dominantHue(image([[40, 40, 40], 50]))).toBeNull()
  })
  it('retient la couleur la plus présente', () => {
    expect(dominantHue(image([[230, 120, 30], 80], [[60, 90, 200], 20]))).toBeCloseTo(dominantHue(image([[230, 120, 30], 1]))!, 0)
  })
})
