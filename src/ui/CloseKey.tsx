import { Icon } from './Icon.tsx'

/** Fermer une fenêtre : la touche Échap dessinée en pastille, et une croix ; un clic fait de même. */
export function CloseKey({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="close-key" onClick={onClick} aria-label="Fermer (Échap)">
      <kbd>Échap</kbd>
      <Icon name="close" />
    </button>
  )
}
