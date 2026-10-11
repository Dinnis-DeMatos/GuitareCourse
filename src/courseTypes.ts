// Forme des données échangées entre le serveur local (server/) et l'application (src/).

export type MediaKind = 'video' | 'audio' | 'tab'

export interface CourseFile {
  /** Nom à afficher, sans l'extension. */
  title: string
  /** Extension en minuscules, sans le point (ex. « mp4 »). */
  ext: string
  kind: MediaKind
  /** Chemin relatif au dossier du cours, avec « / » : sert à construire l'URL /media/… */
  path: string
  size: number
}

/** Progression sur une vidéo. */
export interface VideoProgress {
  /** Dernière position de lecture, en secondes. */
  position: number
  /** Durée de la vidéo, en secondes (0 si inconnue). */
  duration: number
  /** Vidéo terminée (vue jusqu'à la fin, ou marquée comme vue). */
  completed: boolean
  /** Date ISO de la dernière mise à jour. */
  updatedAt: string
}

/** Progression de toutes les vidéos, indexée par le `path` du fichier. */
export type ProgressMap = Record<string, VideoProgress>

export interface CourseFolder {
  /** Nom à afficher (accents normalisés). */
  name: string
  path: string
  folders: CourseFolder[]
  files: CourseFile[]
}
