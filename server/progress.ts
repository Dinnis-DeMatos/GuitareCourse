import type { ProgressMap, VideoProgress } from '../src/courseTypes.ts'
import { readJson, updateJson } from './jsonStore.ts'

export function readProgress(file: string): Promise<ProgressMap> {
  return readJson<ProgressMap>(file, {})
}

/** Enregistre la progression d'une vidéo et renvoie l'entrée enregistrée. */
export async function saveProgress(
  file: string,
  videoPath: string,
  update: Pick<VideoProgress, 'position' | 'duration' | 'completed'>,
): Promise<VideoProgress> {
  const entry: VideoProgress = { ...update, updatedAt: new Date().toISOString() }
  await updateJson<ProgressMap>(file, {}, (all) => ({ ...all, [videoPath]: entry }))
  return entry
}
