import { MAX_ROUTINES, isRoutine, type Routine } from '../src/routines.ts'
import { readJson, updateJson } from './jsonStore.ts'

/** Les routines enregistrées, dans l'ordre de création ; une routine abîmée à la main n'est pas montrée mais reste dans le fichier. */
export async function readRoutines(file: string): Promise<Routine[]> {
  return (await readJson<unknown[]>(file, [])).filter(isRoutine)
}

/** Valide le corps d'un PUT /api/routines ({ id, routine }, routine null pour supprimer) ; null s'il est incorrect. */
export function parseRoutineUpdate(body: unknown): { id: string; routine: Routine | null } | null {
  if (typeof body !== 'object' || body === null) return null
  const { id, routine } = body as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return null
  if (routine === null) return { id, routine: null }
  return isRoutine(routine) && routine.id === id ? { id, routine } : null
}

/** Ajoute, remplace (même id) ou supprime une routine ; renvoie la liste à jour. */
export function saveRoutine(file: string, id: string, routine: Routine | null): Promise<Routine[]> {
  return updateJson<Routine[]>(file, [], (list) => {
    if (!routine) return list.filter((r) => r.id !== id)
    const saved = { ...routine, updatedAt: new Date().toISOString() }
    const index = list.findIndex((r) => r.id === id)
    if (index >= 0) return list.with(index, saved)
    if (list.length >= MAX_ROUTINES) throw new Error('Liste des routines pleine.')
    return [...list, saved]
  })
}
