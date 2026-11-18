// Les fenêtres de la recherche, des outils et du profil s'ouvrent sans bloquer la page (show(), pas
// showModal()) : la barre de navigation reste cliquable. Le voile est dessiné par la page (nav.css), et
// Échap comme un clic dans la barre passent par ici.

const OPEN_PANELS = 'dialog.tool-panel[open], dialog.search-panel[open]'

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
