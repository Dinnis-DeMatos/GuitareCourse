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
