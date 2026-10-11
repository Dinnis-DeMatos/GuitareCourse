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

/** Repère posé dans une vidéo : un instant, ou un passage (début → fin) à retravailler en boucle. */
export interface Bookmark {
  id: string
  /** Position en secondes (début du passage). */
  time: number
  /** Fin du passage en secondes ; absente pour un simple repère. */
  end?: number
  label: string
}

/** Ce que vous ajoutez vous-même à une leçon. */
export interface LessonAnnotations {
  notes: string
  bookmarks: Bookmark[]
}

/** Annotations de toutes les leçons, indexées par le `path` de la vidéo. */
export type AnnotationsMap = Record<string, LessonAnnotations>

export interface CourseFolder {
  /** Nom à afficher (accents normalisés). */
  name: string
  path: string
  folders: CourseFolder[]
  files: CourseFile[]
}
