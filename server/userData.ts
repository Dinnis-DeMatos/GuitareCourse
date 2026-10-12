import { constants } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export const DATA_FILES = ['progress.json', 'favorites.json', 'annotations.json']

/**
 * Reprend les données d'un ancien dossier data/ (le premier de `oldDirs` qui a le fichier).
 * Un fichier déjà présent dans `newDir` n'est jamais écrasé : la migration peut se rejouer sans risque.
 */
export async function migrateDataFiles(oldDirs: string[], newDir: string): Promise<void> {
  await mkdir(newDir, { recursive: true })
  for (const name of DATA_FILES) {
    for (const oldDir of oldDirs) {
      if (path.resolve(oldDir) === path.resolve(newDir)) continue
      try {
        await copyFile(path.join(oldDir, name), path.join(newDir, name), constants.COPYFILE_EXCL)
        break
      } catch (error) {
        // EEXIST : déjà migré ou déjà utilisé, on s'arrête là pour ce fichier ; ENOENT : essayer l'ancien dossier suivant.
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') break
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
  }
}
