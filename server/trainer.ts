import { readJson, updateJson } from './jsonStore.ts'

/** Bilan d'une note (une corde, un nom de note) : présentée `tries` fois, ratée `misses` fois. */
export interface NoteStats {
  tries: number
  misses: number
}

export interface TrainerSession {
  date: string
  mode: 'free' | 'timed'
  /** Bonnes réponses, et essais (mauvaises notes et réponses montrées comprises). */
  right: number
  tries: number
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
    for (const [key, { tries, misses }] of Object.entries(result.notes)) {
      const before = notes[key] ?? { tries: 0, misses: 0 }
      notes[key] = { tries: before.tries + tries, misses: before.misses + misses }
    }
    const session = { date: date.toISOString(), mode: result.mode, right: result.right, tries: result.tries }
    return { notes, sessions: [...current.sessions, session].slice(-MAX_SESSIONS) }
  })
}

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100_000

/** Valide le corps d'un PUT /api/trainer ; renvoie null s'il est incorrect. */
export function parseSessionResult(body: unknown): SessionResult | null {
  if (typeof body !== 'object' || body === null) return null
  const { mode, right, tries, notes } = body as Record<string, unknown>
  if (mode !== 'free' && mode !== 'timed') return null
  if (!isCount(right) || !isCount(tries) || right > tries) return null
  if (typeof notes !== 'object' || notes === null || Array.isArray(notes)) return null
  const parsed: Record<string, NoteStats> = {}
  for (const [key, value] of Object.entries(notes)) {
    // Six cordes (0 à 5), douze notes (0 à 11).
    if (!/^[0-5]-(\d|1[01])$/.test(key) || typeof value !== 'object' || value === null) return null
    const { tries: noteTries, misses } = value as Record<string, unknown>
    if (!isCount(noteTries) || !isCount(misses) || misses > noteTries) return null
    parsed[key] = { tries: noteTries, misses }
  }
  return { mode, right, tries, notes: parsed }
}
