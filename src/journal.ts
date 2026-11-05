import type { ChordProgression, ProgressMap } from './courseTypes.ts'
import type { Routine, RoutineRun } from './routines.ts'
import type { Tone } from './tones.ts'

// Le parcours de l'accueil : ce qu'on a fait, jour par jour, tiré des données déjà enregistrées.

export type JournalKind = 'lesson' | 'trainer' | 'chords' | 'tone' | 'routine' | 'run'

export interface JournalEvent {
  /** Date ISO. */
  date: string
  kind: JournalKind
  title: string
  detail: string
  /** La leçon terminée, pour la rouvrir d'un clic. */
  lessonId?: string
}

export interface JournalDay {
  /** « 2026-11-05 », en heure locale. */
  key: string
  /** « Aujourd'hui », « Hier », « mardi 3 novembre ». */
  label: string
  events: JournalEvent[]
}

export interface JournalSources {
  progress: ProgressMap | null
  /** Les leçons connues : une vidéo sortie des cours n'apparaît plus. */
  lessons: { id: string; title: string; course: string }[]
  trainer: { date: string; mode: string; right: number; tries: number }[] | null
  chords: ChordProgression[] | null
  tones: Tone[] | null
  routines: Routine[] | null
  runs: RoutineRun[] | null
}

const MODES: Record<string, string> = { free: 'libre', series: 'série', timed: 'défi chronométré' }

/** Tous les événements datés, du plus récent au plus ancien. */
export function buildJournal(s: JournalSources): JournalEvent[] {
  const events: JournalEvent[] = []
  for (const lesson of s.lessons) {
    const entry = s.progress?.[lesson.id]
    if (!entry?.completed) continue
    events.push({ date: entry.completedAt ?? entry.updatedAt, kind: 'lesson', title: lesson.title, detail: `Leçon terminée · ${lesson.course}`, lessonId: lesson.id })
  }
  for (const session of s.trainer ?? []) {
    const mode = MODES[session.mode] ?? session.mode
    events.push({ date: session.date, kind: 'trainer', title: 'Notes du manche', detail: `${session.right} trouvées sur ${session.tries} · ${mode}` })
  }
  for (const run of s.runs ?? []) {
    events.push({ date: run.date, kind: 'run', title: run.name, detail: `Routine menée jusqu'au bout · ${run.minutes} min` })
  }
  // Pour ce qu'on écrit soi-même, seule la dernière modification est datée.
  for (const p of s.chords ?? []) if (p.updatedAt) events.push({ date: p.updatedAt, kind: 'chords', title: p.name, detail: "Suite d'accords notée" })
  for (const t of s.tones ?? []) {
    if (t.updatedAt) events.push({ date: t.updatedAt, kind: 'tone', title: t.artist ? `${t.artist} – ${t.name}` : t.name, detail: 'Son noté' })
  }
  for (const r of s.routines ?? []) if (r.updatedAt) events.push({ date: r.updatedAt, kind: 'routine', title: r.name, detail: 'Routine préparée' })
  return events.filter((e) => !Number.isNaN(Date.parse(e.date))).sort((a, b) => b.date.localeCompare(a.date))
}

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Regroupe des événements déjà triés par jour (heure locale), avec un libellé lisible. */
export function groupByDay(events: JournalEvent[], now = new Date()): JournalDay[] {
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const days: JournalDay[] = []
  for (const event of events) {
    const date = new Date(event.date)
    const key = dayKey(date)
    let day = days.at(-1)
    if (day?.key !== key) {
      const label =
        key === today
          ? "Aujourd'hui"
          : key === yesterday
            ? 'Hier'
            : date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
              })
      day = { key, label, events: [] }
      days.push(day)
    }
    day.events.push(event)
  }
  return days
}
