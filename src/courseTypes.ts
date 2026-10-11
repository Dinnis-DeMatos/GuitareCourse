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

export interface CourseFolder {
  /** Nom à afficher (accents normalisés). */
  name: string
  path: string
  folders: CourseFolder[]
  files: CourseFile[]
}
