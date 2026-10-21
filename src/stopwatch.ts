// Chronomètre du temps de réponse de l'exercice du manche : il se met en pause, puis reprend là où il en était.

export function createStopwatch(now = () => performance.now()) {
  let elapsed = 0
  // Début de la période en cours ; null quand le chronomètre est arrêté.
  let since: number | null = null
  return {
    /** Remet à zéro ; repart aussitôt si `running`. */
    reset(running: boolean) {
      elapsed = 0
      since = running ? now() : null
    },
    start() {
      since ??= now()
    },
    stop() {
      if (since === null) return
      elapsed += now() - since
      since = null
    },
    /** Temps écoulé, pauses non comprises, en millisecondes. */
    read(): number {
      return elapsed + (since === null ? 0 : now() - since)
    },
  }
}
