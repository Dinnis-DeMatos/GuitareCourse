import { useEffect, useState } from 'react'
import type { ProgressMap } from '../courseTypes.ts'
import { PRACTICE_EVENT, readStreak } from '../streak.ts'

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Erreur ${response.status}`)
  return response.json() as Promise<T>
}

/** La série, pour la mascotte de l'accueil et celle de l'ouverture. `streak` est null tant que tout n'est pas lu. */
export function useStreak(progress: ProgressMap | null) {
  const [sessions, setSessions] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => {
      setNow(new Date())
      void Promise.all([read<{ sessions: { date: string }[] }>('/api/trainer'), read<{ date: string }[]>('/api/routine-runs')]).then(
        ([trainer, runs]) => setSessions([...trainer.sessions, ...runs].map((s) => s.date)),
        () => setFailed(true),
      )
    }
    refresh()
    // Une séance peut finir pendant qu'on est sur l'accueil, et minuit peut y passer.
    window.addEventListener(PRACTICE_EVENT, refresh)
    const clock = window.setInterval(() => setNow(new Date()), 60_000)
    return () => {
      window.removeEventListener(PRACTICE_EVENT, refresh)
      window.clearInterval(clock)
    }
  }, [])

  // Pas de série avant d'avoir tout lu : elle paraîtrait perdue.
  return { streak: progress && sessions ? readStreak(progress, sessions, now) : null, failed }
}
