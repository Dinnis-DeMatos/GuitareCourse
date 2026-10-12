# GuitareCourse

Application web (Vite + React + TypeScript) pour suivre ses cours de guitare en vidéo :
progression, favoris, repères, notes, tablatures et backing tracks.

## Lancer l'application

Double-cliquer sur **`Lancer GuitareCourse.cmd`** : le serveur démarre, le navigateur s'ouvre
(adresse `http://localhost:5174`) et la fenêtre se réduit dans la barre des tâches.
**Fermer cette fenêtre arrête le serveur.** Si l'application tourne déjà, le fichier ouvre
seulement le navigateur.

Node.js doit être installé, et `npm.cmd install` lancé une fois dans le dossier.

## Ajouter une méthode de cours

Chaque sous-dossier de `S:\Cours guitare` est une méthode. Pour en ajouter une, déposer son dossier
dedans (vidéos `.mp4`, backing tracks `.wav`, tablatures `.pdf` / `.gp` / `.gpx`) puis recharger la page.
Un dossier renommé ou déplacé perd sa progression, ses favoris, ses repères et ses notes : ils sont
rattachés à son chemin.

## Vos données

Elles sont dans le dossier `data/` (ignoré par Git) :

| Fichier | Contenu |
| --- | --- |
| `progress.json` | position et état « terminée » de chaque vidéo |
| `favorites.json` | leçons favorites |
| `annotations.json` | repères et notes de chaque leçon |

À sauvegarder si elles comptent pour vous : rien d'autre ne les copie.

## Charte visuelle

Une interface à plat, noire et blanche, où une seule couleur vive parle à la fois :

- **Couleur** : un noir neutre, des filets fins, du blanc, et la finition du chapitre affiché, tirée
  d'un nuancier de finitions de guitares. Chaque chapitre reçoit la sienne, dans l'ordre : Fiesta Red,
  Surf Green, Butterscotch, Daphne Blue, Shell Pink, Ocean Turquoise. Elle teinte toute l'application
  tant qu'on reste dans ce chapitre : la pastille numérotée de la leçon (un échantillon de nuancier),
  la leçon en cours dans l'index, le bouton de lecture, les cordes déjà jouées.
- **Formes** : ni dégradé décoratif, ni ombre, ni arrondi. Tout est rectangle, sauf ce que l'on
  touche pour jouer (lecture, curseurs, pastilles), qui est rond.
- **Tablature** : la barre de lecture est une portée à six cordes, qui vibrent quand on les pince
  pour se déplacer ; la boucle tient entre deux signes de reprise, les repères sont numérotés dans un
  cadre comme sur une partition, un backing track fourni à plusieurs tempos s'écrit comme une
  indication de tempo.
- **Typographie** : une seule famille, la DIN livrée avec Windows (Bahnschrift), dans toutes ses
  largeurs et graisses, avec des chiffres de largeur fixe pour les temps.
- **Disposition** : l'index à gauche, la vidéo et ses commandes au centre, le pupitre (repères,
  notes, tablatures, backing tracks) à droite dès que la fenêtre est assez large : tout tient à
  l'écran sans faire défiler. Pendant la lecture, ce qui n'est pas la vidéo s'efface.

Pour changer une couleur ou une police : `src/styles/tokens.css`. L'ordre et le nom des finitions :
`src/finishes.ts`.

Le lecteur vidéo est fait sur mesure (`src/ui/Stage.tsx`, `Pedal.tsx`, `Staff.tsx`) : les commandes
du navigateur ne sont pas utilisées.

## Commandes de développement

```bash
npm.cmd install      # installer les dépendances
npm.cmd run dev      # serveur de développement (port 5174)
npm.cmd run build    # vérification des types + construction
npm.cmd run lint     # oxlint
npm.cmd test         # tests (Vitest)
```

Variables d'environnement utiles : `COURSES_DIR` (dossier des méthodes, par défaut
`S:\Cours guitare`), `PROGRESS_FILE`, `FAVORITES_FILE`, `ANNOTATIONS_FILE` (emplacement des données).

Version de Node : voir `.node-version`.
