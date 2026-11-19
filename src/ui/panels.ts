// Les fenêtres de la recherche, des outils et du profil s'ouvrent sans bloquer la page (show(), pas
// showModal()) : la barre de navigation reste cliquable. Le voile est dessiné par la page (nav.css), et
// Échap comme un clic dans la barre passent par ici.

import { flushSync } from 'react-dom'

const OPEN_PANELS ='dialog.tool-panel[open], dialog.search-panel[open]'

/** Les fenêtres d'outil ouvertes, de la plus ancienne à la plus récente. */
export const openPanels = () => [...document.querySelectorAll<HTMLDialogElement>(OPEN_PANELS)]

/**
 * Demande à une fenêtre de se fermer, comme Échap le fait pour une fenêtre modale : l'évènement « cancel »
 * part d'abord, et la fenêtre peut le refuser (une suite d'accords pas encore enregistrée…).
 */
export function requestClose(dialog: HTMLDialogElement) {
  if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close()
}

/**
 * Ouvre une fenêtre à la place de celles ouvertes : d'un outil à l'autre, le voile ne s'efface pas. Rouvrir
 * celle déjà ouverte la laisse telle quelle (la fermer d'abord la laissait fermée, son état restant « ouvert »).
 * Si une fenêtre refuse de se fermer (modifications non enregistrées), la nouvelle se referme.
 */
export function replacePanels(open: () => void) {
  const before = openPanels()
  // Rendu et effets tout de suite (les fenêtres s'ouvrent dans un useEffect) : on voit ce qui s'est ouvert.
  flushSync(open)
  const fresh = openPanels().filter((dialog) => !before.includes(dialog))
  if (fresh.length === 0) return
  before.forEach(requestClose)
  if (before.some((dialog) => dialog.open)) fresh.forEach((dialog) => dialog.close())
}

/**
 * Échap ferme la fenêtre d'outil la plus récente. Une fenêtre qui gère déjà Échap (preventDefault), un
 * menu ouvert par-dessus (roue des outils, profil) ou un champ en cours de saisie dans un menu passent avant.
 */
export function closeOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector(':popover-open')) return
  const last = openPanels().at(-1)
  if (!last) return
  event.preventDefault()
  requestClose(last)
}
