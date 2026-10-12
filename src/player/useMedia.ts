import { useEffect, useState, type RefObject } from 'react'

/** État d'une vidéo ou d'un son qui change rarement (pas la position : voir useMediaSeconds). */
export interface MediaFlags {
  paused: boolean
  /** La lecture attend des données (mise en mémoire tampon). */
  waiting: boolean
  /** Le fichier n'a pas pu être lu. */
  failed: boolean
  /** Durée en secondes ; 0 tant qu'elle est inconnue. */
  duration: number
}

const INITIAL: MediaFlags = { paused: true, waiting: false, failed: false, duration: 0 }

const FLAG_EVENTS = [
  'play',
  'playing',
  'pause',
  'ended',
  'waiting',
  'canplay',
  'seeked',
  'loadstart',
  'loadedmetadata',
  'durationchange',
  'emptied',
  'error',
] as const

const STOPS_WAITING = new Set(['playing', 'canplay', 'seeked', 'pause', 'ended', 'emptied', 'error', 'loadedmetadata'])

function nextFlags(media: HTMLMediaElement, type: string, previous: MediaFlags): MediaFlags {
  const waiting = type === 'waiting' ? true : STOPS_WAITING.has(type) ? false : previous.waiting
  const failed = type === 'error' ? true : type === 'loadstart' || type === 'loadedmetadata' ? false : previous.failed
  const duration = Number.isFinite(media.duration) ? media.duration : 0
  if (
    previous.paused === media.paused &&
    previous.waiting === waiting &&
    previous.failed === failed &&
    previous.duration === duration
  ) {
    return previous
  }
  return { paused: media.paused, waiting, failed, duration }
}

/** Suit l'état de lecture d'un élément <video> ou <audio>. */
export function useMediaFlags(ref: RefObject<HTMLMediaElement | null>): MediaFlags {
  const [flags, setFlags] = useState(INITIAL)
  useEffect(() => {
    const media = ref.current
    if (!media) return
    const update = (event: Event) => setFlags((previous) => nextFlags(media, event.type, previous))
    for (const type of FLAG_EVENTS) media.addEventListener(type, update)
    setFlags((previous) => nextFlags(media, 'init', previous))
    return () => {
      for (const type of FLAG_EVENTS) media.removeEventListener(type, update)
    }
  }, [ref])
  return flags
}

const TIME_EVENTS = ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'emptied'] as const

/** Position de lecture en secondes entières : un rendu par seconde, pas quatre. */
export function useMediaSeconds(ref: RefObject<HTMLMediaElement | null>): number {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const media = ref.current
    if (!media) return
    const update = () => setSeconds(Math.floor(media.currentTime))
    for (const type of TIME_EVENTS) media.addEventListener(type, update)
    update()
    return () => {
      for (const type of TIME_EVENTS) media.removeEventListener(type, update)
    }
  }, [ref])
  return seconds
}
