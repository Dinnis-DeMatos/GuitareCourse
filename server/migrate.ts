import { constants } from 'node:fs'
import { copyFile, readdir } from 'node:fs/promises'
import { readJson, updateJson } from './jsonStore.ts'

/** Méthode qui était seule avant l'arrivée des méthodes multiples : ses chemins n'avaient pas de préfixe. */
export const LEGACY_COURSE = 'Méthode polyvalante'

/**
 * Les chemins enregistrés étaient relatifs au dossier de la méthode ; ils sont maintenant relatifs à
 * `S:\Cours guitare` et commencent donc par le nom de la méthode. Un chemin déjà préfixé est inchangé.
 */
export function prefixLegacyPath(key: string, courseNames: ReadonlySet<string>, legacyCourse = LEGACY_COURSE) {
  return courseNames.has(key.split('/')[0]) ? key : `${legacyCourse}/${key}`
}

/** Copie de sécurité faite une seule fois, avant la première modification. */
async function backup(file: string) {
  await copyFile(file, `${file}.avant-methodes-multiples`, constants.COPYFILE_EXCL).catch(() => undefined)
}

/** Met à jour progression et favoris existants. Sans effet s'ils sont déjà au nouveau format. */
export async function migrateLegacyPaths(
  coursesDir: string,
  progressFile: string,
  favoritesFile: string,
  legacyCourse = LEGACY_COURSE,
): Promise<void> {
  const entries = await readdir(coursesDir, { withFileTypes: true })
  const names = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name))
  // Si la méthode d'origine n'est plus là, on ne devine rien : les chemins restent tels quels.
  if (!names.has(legacyCourse)) return
  const fix = (key: string) => prefixLegacyPath(key, names, legacyCourse)

  const progress = await readJson<Record<string, unknown>>(progressFile, {})
  if (Object.keys(progress).some((key) => fix(key) !== key)) {
    await backup(progressFile)
    await updateJson<Record<string, unknown>>(progressFile, {}, (current) =>
      Object.fromEntries(Object.entries(current).map(([key, value]) => [fix(key), value])),
    )
  }

  const favorites = await readJson<string[]>(favoritesFile, [])
  if (favorites.some((key) => fix(key) !== key)) {
    await backup(favoritesFile)
    await updateJson<string[]>(favoritesFile, [], (current) => [...new Set(current.map(fix))])
  }
}
