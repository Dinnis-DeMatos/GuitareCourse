// Partitions Guitar Pro : corrections apportées à ce qu'alphaTab a lu, avant qu'il ne les dessine.

import type { model } from '@coderline/alphatab'

/**
 * Dans un diagramme d'accord Guitar Pro, la case 0 est une corde à vide. alphaTab (1.8.4) lui ajoute la
 * case de départ du diagramme : la corde à vide devient une note une case au-dessus de la grille, et
 * s'affiche comme un « 0 » barré d'un point au lieu du rond de la corde à vide. On la remet à 0.
 */
export function fixOpenStrings(score: model.Score): void {
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (const chord of staff.chords?.values() ?? []) {
        if (chord.firstFret > 1) chord.strings = chord.strings.map((fret) => (fret === chord.firstFret - 1 ? 0 : fret))
      }
    }
  }
}

/**
 * Changements de tempo à l'entier : un fichier peut en porter un calculé (« 88.2556 »), qu'alphaTab écrit tel quel.
 * alphaTab joue la valeur qu'il affiche : la lecture suit l'arrondi, à moins d'un tempo près.
 */
export function roundTempos(score: model.Score): void {
  for (const bar of score.masterBars) {
    for (const automation of bar.tempoAutomations) automation.value = Math.round(automation.value)
  }
}
