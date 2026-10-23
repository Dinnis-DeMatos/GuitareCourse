import { readJson, updateJson } from './jsonStore.ts'

/**
 * Bilan d'une note (une corde, un nom de note) : présentée `tries` fois, ratée `misses` fois, trouvée
 * `found` fois en `time` millisecondes au total. Ces deux derniers manquent dans les bilans d'avant la 0.1.13.
 */
export interface NoteStats {
  tries: number
  misses: number
  found?: number
  time?: number
}

export interface TrainerSession {
  date: string
  /** Libre, série d'une longueur fixe, ou défi chronométré. */
  mode: 'free' | 'series' | 'timed'
  /** Bonnes réponses, et essais (mauvaises notes et réponses montrées comprises). */
  right: number
  tries: number
  /** Temps total mis à trouver les bonnes réponses, en millisecondes (absent avant la 0.1.13). */
  time?: number
}

export interface TrainerData {
  /** Clé « corde-note » : « 4-7 » pour Sol sur la corde de La (voir src/pitch.ts). */
  notes: Record<string, NoteStats>
  /** Séances, de la plus ancienne à la plus récente. */
  sessions: TrainerSession[]
}

export type SessionResult = Omit<TrainerSession, 'date'> & { notes: Record<string, NoteStats> }

const MAX_SESSIONS = 100
const EMPTY: TrainerData = { notes: {}, sessions: [] }

export function readTrainer(file: string): Promise<TrainerData> {
  return readJson(file, EMPTY)
}

/** Ajoute une séance à l'historique et cumule le bilan de ses notes ; renvoie les données à jour. */
export function saveSession(file: string, result: SessionResult, date = new Date()): Promise<TrainerData> {
  return updateJson(file, EMPTY, (current) => {
    const notes = { ...current.notes }
    for (const [key, n] of Object.entries(result.notes)) {
      const before = notes[key] ?? { tries: 0, misses: 0 }
      notes[key] = {
        tries: before.tries + n.tries,
        misses: before.misses + n.misses,
        found: (before.found ?? 0) + (n.found ?? 0),
        time: (before.time ?? 0) + (n.time ?? 0),
      }
    }
    const { mode, right, tries, time } = result
    const session = { date: date.toISOString(), mode, right, tries, time }
    return { notes, sessions: [...current.sessions, session].slice(-MAX_SESSIONS) }
  })
}

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100_000
// Un temps en millisecondes : au plus une journée.
const isTime = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 86_400_000

/** Valide le corps d'un PUT /api/trainer ; renvoie null s'il est incorrect. */
export function parseSessionResult(body: unknown): SessionResult | null {
  if (typeof body !== 'object' || body === null) return null
  const { mode, right, tries, time, notes } = body as Record<string, unknown>
  if (mode !== 'free' && mode !== 'series' && mode !== 'timed') return null
  if (!isCount(right) || !isCount(tries) || right > tries || !isTime(time)) return null
  if (typeof notes !== 'object' || notes === null || Array.isArray(notes)) return null
  const parsed: Record<string, NoteStats> = {}
  for (const [key, value] of Object.entries(notes)) {
    // Six cordes (0 à 5), douze notes (0 à 11).
    if (!/^[0-5]-(\d|1[01])$/.test(key) || typeof value !== 'object' || value === null) return null
    const { tries: noteTries, misses, found, time: noteTime } = value as Record<string, unknown>
    if (!isCount(noteTries) || !isCount(misses) || misses > noteTries) return null
    if (!isCount(found) || found > noteTries || !isTime(noteTime)) return null
    parsed[key] = { tries: noteTries, misses, found, time: noteTime }
  }
  return { mode, right, tries, time, notes: parsed }
}
