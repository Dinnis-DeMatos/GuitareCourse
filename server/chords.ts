import type { ChordProgression } from '../src/courseTypes.ts'
import { MAX_PROGRESSIONS, isProgression } from '../src/progressions.ts'
import { readJson, updateJson } from './jsonStore.ts'

/** Carnet d'accords : les suites enregistrées, dans l'ordre où on les a créées. */
export function readProgressions(file: string): Promise<ChordProgression[]> {
  return readJson<ChordProgression[]>(file, [])
}

/** Valide le corps d'un PUT /api/chords ({ id, progression }, progression null pour supprimer) ; null s'il est incorrect. */
export function parseProgressionUpdate(body: unknown): { id: string; progression: ChordProgression | null } | null {
  if (typeof body !== 'object' || body === null) return null
  const { id, progression } = body as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return null
  if (progression === null) return { id, progression: null }
  return isProgression(progression) && progression.id === id ? { id, progression } : null
}

/** Ajoute, remplace (même id) ou supprime une suite ; renvoie le carnet à jour. */
export function saveProgression(file: string, id: string, progression: ChordProgression | null): Promise<ChordProgression[]> {
  return updateJson<ChordProgression[]>(file, [], (list) => {
    if (!progression) return list.filter((p) => p.id !== id)
    const index = list.findIndex((p) => p.id === id)
    if (index >= 0) return list.with(index, progression)
    if (list.length >= MAX_PROGRESSIONS) throw new Error('Carnet plein.')
    return [...list, progression]
  })
}
