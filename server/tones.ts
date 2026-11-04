import { MAX_TONES, isTone, type Tone } from '../src/tones.ts'
import { readJson, updateJson } from './jsonStore.ts'

/** Les sons enregistrés, dans l'ordre de création ; un son abîmé à la main n'est pas montré mais reste dans le fichier. */
export async function readTones(file: string): Promise<Tone[]> {
  return (await readJson<unknown[]>(file, [])).filter(isTone)
}

/** Valide le corps d'un PUT /api/tones ({ id, tone }, tone null pour supprimer) ; null s'il est incorrect. */
export function parseToneUpdate(body: unknown): { id: string; tone: Tone | null } | null {
  if (typeof body !== 'object' || body === null) return null
  const { id, tone } = body as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 64) return null
  if (tone === null) return { id, tone: null }
  return isTone(tone) && tone.id === id ? { id, tone } : null
}

/** Ajoute, remplace (même id) ou supprime un son ; renvoie la liste à jour. */
export function saveTone(file: string, id: string, tone: Tone | null): Promise<Tone[]> {
  return updateJson<Tone[]>(file, [], (list) => {
    if (!tone) return list.filter((t) => t.id !== id)
    const saved = { ...tone, updatedAt: new Date().toISOString() }
    const index = list.findIndex((t) => t.id === id)
    if (index >= 0) return list.with(index, saved)
    if (list.length >= MAX_TONES) throw new Error('Liste des sons pleine.')
    return [...list, saved]
  })
}
