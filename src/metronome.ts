// Le métronome du pupitre : bornes du tempo, tempo tapé, et le moteur qui joue les clics.

export const MIN_BPM = 30
export const MAX_BPM = 250

/** Temps par mesure proposés ; le premier temps de chaque mesure est accentué. */
export const BEATS = [2, 3, 4, 6] as const

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

/** Au-delà de cet écart entre deux frappes, on recommence à compter. */
const TAP_RESET_MS = 2000

/**
 * Tempo tapé : la moyenne des derniers écarts entre frappes (instants en millisecondes, du plus ancien
 * au plus récent). Null tant qu'il n'y a pas deux frappes assez rapprochées.
 */
export function tapTempo(taps: number[]): number | null {
  const recent: number[] = []
  for (let i = taps.length - 1; i > 0 && recent.length < 4; i--) {
    const gap = taps[i] - taps[i - 1]
    if (gap <= 0 || gap > TAP_RESET_MS) break
    recent.push(gap)
  }
  if (recent.length === 0) return null
  return clampBpm(60000 / (recent.reduce((sum, gap) => sum + gap, 0) / recent.length))
}

/** Réglages lus à chaque clic : les changer pendant que le métronome tourne vaut dès le temps suivant. */
export interface MetronomeSettings {
  bpm: number
  beats: number
  /** De 0 à 1. */
  volume: number
}

/** Les clics sont programmés un peu à l'avance sur l'horloge audio : ils restent réguliers même si la page est occupée. */
const LOOKAHEAD_S = 0.1
const TICK_MS = 25

/**
 * Lance le métronome. `onBeat` reçoit le rang du temps (0 = premier temps de la mesure) au moment où on
 * l'entend. Renvoie la fonction qui l'arrête.
 */
export function startMetronome(settings: () => MetronomeSettings, onBeat: (beat: number) => void): () => void {
  const context = new AudioContext()
  let next = context.currentTime + 0.05
  let beat = 0
  const timers = new Set<number>()

  function click(at: number, accent: boolean, volume: number) {
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.frequency.value = accent ? 1600 : 1000
    gain.gain.setValueAtTime(volume, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
    osc.connect(gain).connect(context.destination)
    osc.start(at)
    osc.stop(at + 0.06)
  }

  const interval = window.setInterval(() => {
    while (next < context.currentTime + LOOKAHEAD_S) {
      const { bpm, beats, volume } = settings()
      if (beat >= beats) beat = 0
      if (volume > 0) click(next, beat === 0, volume)
      const shown = beat
      const timer = window.setTimeout(
        () => {
          timers.delete(timer)
          onBeat(shown)
        },
        Math.max(0, (next - context.currentTime) * 1000),
      )
      timers.add(timer)
      next += 60 / bpm
      beat++
    }
  }, TICK_MS)

  return () => {
    window.clearInterval(interval)
    for (const timer of timers) window.clearTimeout(timer)
    void context.close()
  }
}
