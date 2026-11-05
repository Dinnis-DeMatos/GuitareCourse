import type { ProgressMap, VideoProgress } from '../src/courseTypes.ts'
import { nextProgress } from '../src/progress.ts'
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
  let entry: VideoProgress | undefined
  await updateJson<ProgressMap>(file, {}, (all) => {
    entry = nextProgress(all[videoPath], update, new Date().toISOString())
    return { ...all, [videoPath]: entry }
  })
  return entry!
}
