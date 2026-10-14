# GuitareCourse

Application de bureau Windows (Electron + Vite + React + TypeScript) pour suivre ses cours de guitare
en vidéo : progression, favoris, repères, notes, tablatures et backing tracks.

## Installer et lancer

Lancer **`GuitareCourse-Setup-<version>.exe`** (produit par `npm.cmd run electron:build`, dans
`release/`). L'installation se fait en un clic, sans droits d'administrateur, dans
`%LOCALAPPDATA%\Programs\GuitareCourse`, avec un raccourci sur le bureau et dans le menu Démarrer.
Rien d'autre n'est à installer (ni Node.js, ni navigateur).

Au premier lancement, l'application demande le dossier du cours et le retient. L'installeur n'est pas
signé : Windows SmartScreen peut afficher un avertissement la première fois (« Informations
complémentaires » → « Exécuter quand même »).

Désinstaller : Paramètres Windows → Applications. Vos données sont conservées.

## Ajouter une méthode de cours

Chaque sous-dossier du dossier du cours est une méthode. Pour en ajouter une, déposer son dossier
dedans (vidéos `.mp4`, backing tracks `.wav`, tablatures `.pdf` / `.gp` / `.gpx`) puis relancer l'application.
Un dossier renommé ou déplacé perd sa progression, ses favoris, ses repères et ses notes : ils sont
rattachés à son chemin.

## Vos données

Elles sont dans `%APPDATA%\GuitareCourse` :

| Fichier | Contenu |
| --- | --- |
| `data\progress.json` | position et état « terminée » de chaque vidéo |
| `data\favorites.json` | leçons favorites |
| `data\annotations.json` | repères et notes de chaque leçon |
| `settings.json` | dossier du cours, position et taille de la fenêtre |

À sauvegarder si elles comptent pour vous : rien d'autre ne les copie. Pour choisir un autre dossier
de cours, supprimer `settings.json` : l'application le redemande.

**Reprendre les données d'avant l'application de bureau** : copier les trois fichiers de l'ancien
dossier `data/` du projet dans `%APPDATA%\GuitareCourse\data` avant le premier lancement. La reprise
n'est automatique que si l'ancien `data/` est à côté de l'exécutable ou dans le dossier de lancement ;
un fichier déjà présent n'est jamais écrasé.

En développement (`npm.cmd run dev` et `electron:dev`), les données restent dans le dossier `data/`
du projet (ignoré par Git).

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

npm.cmd run electron:dev     # Vite + fenêtre Electron (rechargement à chaud)
npm.cmd run electron:build   # installeur Windows dans release/ (ne publie rien)
npm.cmd run release         # idem, puis publie dans une Release GitHub (mises à jour)
npm.cmd run electron:icon    # refait electron/icon.ico à partir de public/favicon.svg
```

Variables d'environnement utiles : `COURSES_DIR` (dossier des méthodes ; par défaut `S:\Cours guitare`
en développement, le dossier choisi dans l'application installée). En développement seulement :
`PROGRESS_FILE`, `FAVORITES_FILE`, `ANNOTATIONS_FILE` (emplacement des données).

## Application de bureau

- `electron/main.ts` lance le même service que le serveur de développement (`courseHandler`,
  `server/courseServer.ts`) sur `127.0.0.1`, port libre, jamais exposé au réseau, et y charge
  l'application construite. `electron/preload.ts` n'expose rien de Node à la page.
- `scripts/electron.mjs` compile ces deux fichiers en un seul `main.cjs` (dépendances comprises :
  l'application empaquetée n'a pas de `node_modules`) dans `build/electron/`, y copie `dist/`, puis
  appelle electron-builder. Sa configuration est dans `package.json`, clé `build`.
- Pour essayer l'application installée sans toucher à ses vraies données :
  `GuitareCourse.exe --user-data-dir=<dossier vide>`.

### Mises à jour automatiques

L'application installée cherche une version plus récente à chaque démarrage, dans les *Releases*
GitHub du dépôt indiqué dans `package.json` (`build.publish`, aujourd'hui
`Dinnis-DeMatos/GuitareCourse`). Elle la télécharge en fond, prévient par une notification, et
l'installe à la fermeture. Hors ligne ou sans version publiée, elle démarre normalement.

Le dépôt doit être **public** : un dépôt privé demanderait un jeton d'accès embarqué dans l'application.

Publier une version : augmenter `version` dans `package.json`, committer et pousser, puis

```bash
npm.cmd run release   # construit l'installeur et le publie dans une Release GitHub (jeton : `gh auth token`)
```

### Ce que l'application remplace

Les anciens lanceurs ont été retirés (ils restent dans l'historique Git, branche `refonte-interface`) :

| Retiré | Ce que c'était | Remplacé par |
| --- | --- | --- |
| `Lancer GuitareCourse.cmd` | serveur de développement + onglet du navigateur | l'application installée ; `npm.cmd run dev` pour développer |
| `scripts/build-exe.mjs`, `server/standalone.ts` (`npm run build:exe`) | `GuitareCourse.exe` autonome ouvrant une fenêtre Edge/Chrome | `npm.cmd run electron:build` |

Un ancien `GuitareCourse.exe` à la racine du projet peut être supprimé.

Version de Node : voir `.node-version`.
