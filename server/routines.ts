import { MAX_ROUTINES, isRoutine, type Routine, type RoutineRun } from '../src/routines.ts'
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

/** On garde les routines terminées des dernières années, pas davantage. */
const MAX_RUNS = 2000

const isRun = (value: unknown): value is RoutineRun => {
  if (typeof value !== 'object' || value === null) return false
  const { date, name, minutes } = value as Record<string, unknown>
  return typeof date === 'string' && typeof name === 'string' && typeof minutes === 'number'
}

/** Les routines menées jusqu'au bout, de la plus ancienne à la plus récente. */
export async function readRuns(file: string): Promise<RoutineRun[]> {
  return (await readJson<unknown[]>(file, [])).filter(isRun)
}

/** Note une routine terminée, datée maintenant ; renvoie la liste à jour. */
export function addRun(file: string, run: Omit<RoutineRun, 'date'>, date = new Date()): Promise<RoutineRun[]> {
  return updateJson<RoutineRun[]>(file, [], (list) => [...list, { date: date.toISOString(), ...run }].slice(-MAX_RUNS))
}
