import { useEffect, useRef } from 'react'
import { SHORTCUT_HELP } from '../shortcuts.ts'

/** Le mode d'emploi : chaque partie de l'application en quelques lignes. */
const GUIDE: { title: string; text: string }[] = [
  {
    title: 'Le dossier du cours',
    text: "Au premier lancement, choisissez le dossier qui contient vos méthodes ; « Options → Changer le dossier du cours » permet d'en prendre un autre. Chaque sous-dossier est une méthode, ses dossiers deviennent les chapitres et épisodes du plan, et chaque vidéo .mp4 une leçon. Les backing tracks (.wav) et tablatures (.pdf, .gp, .gpx) rangés avec une vidéo lui sont rattachés. Après avoir ajouté une méthode, relancez l'application.",
  },
  {
    title: 'Suivre le cours',
    text: "Le plan est à gauche ; s'il y a plusieurs méthodes, le menu « Méthode » passe de l'une à l'autre. La position de chaque vidéo est retenue, et une leçon regardée presque jusqu'au bout est marquée terminée. Le bouton de lecture à côté du nom reprend là où vous en étiez. L'étoile met une leçon dans vos favoris, en tête du plan.",
  },
  {
    title: 'Travailler un passage',
    text: "Ralentissez la vidéo sans changer la hauteur du son. Posez le début et la fin d'une boucle pour rejouer un passage autant de fois que nécessaire. Un repère marque un instant pour y revenir d'un clic ; avec une fin, il rejoue son passage en boucle.",
  },
  {
    title: 'Le pupitre',
    text: "À droite de la vidéo : vos notes sur la leçon (enregistrées pendant la saisie), ses tablatures (le PDF s'affiche à la place de la vidéo ; « Jouer la partition » y affiche le fichier Guitar Pro et le joue : vitesse, métronome, boucle sur les mesures sélectionnées en glissant dessus), ses backing tracks, proposés à chaque tempo fourni, et le métronome (tempo réglé au curseur, d'un cran, en le tapant en rythme ou en l'écrivant : cliquez sur le nombre, ou tapez-le directement dans la fenêtre « Métronome » ; le premier temps de chaque mesure est accentué), qu'ouvre aussi le bouton « Métronome » de l'index : c'est le même. Il continue de battre d'une leçon à l'autre, et s'arrête quand on ferme cette fenêtre.",
  },
  {
    title: 'Exercice du manche',
    text: "Le bouton « Manche » ouvre un exercice pour apprendre les notes du manche : l'application en demande une, vous la jouez, le micro l'écoute. Jeu libre, série ou défi chronométré ; le bilan montre les notes les plus souvent ratées.",
  },
  {
    title: 'Vos données',
    text: 'Progression, favoris, repères et notes restent sur cet ordinateur, et suivent une vidéo dont on renomme ou déplace le dossier (ou le fichier), tant qu’elle reste dans le dossier du cours. Les mises à jour de l’application s’installent seules, à la fermeture.',
  },
]

/** Fenêtre du guide : le mode d'emploi, puis les raccourcis clavier. Échap la ferme. */
export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      // Le focus va au bouton « Fermer », tout en bas : on lit le guide depuis le début.
      element.scrollTop = 0
    }
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="guide-title"
      onClose={onClose}
    >
      <div className="sheet-body">
        <p className="sheet-kicker">Notice</p>
        <h2 id="guide-title">Guide</h2>
        {GUIDE.map((part) => (
          <section key={part.title} className="sheet-part">
            <h3>{part.title}</h3>
            <p>{part.text}</p>
          </section>
        ))}
        <h3 className="sheet-part-title">Raccourcis clavier</h3>
        <dl>
          {SHORTCUT_HELP.map((line) => (
            <div key={line.label}>
              <dt>
                {line.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{line.label}</dd>
            </div>
          ))}
        </dl>
        <p className="sheet-note">
          Ils fonctionnent tant que vous n'êtes pas en train d'écrire dans un champ (nom d'un repère, notes).
        </p>
        <button type="button" className="sheet-close" onClick={onClose}>
          Fermer
        </button>
      </div>
    </dialog>
  )
}
