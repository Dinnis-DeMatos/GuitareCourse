import { describe, expect, it } from 'vitest'
import type { VideoProgress } from './courseTypes.ts'
import { formatTime, isCompleted, resumePosition } from './progress.ts'

const progress = (over: Partial<VideoProgress>): VideoProgress => ({
  position: 0,
  duration: 100,
  completed: false,
  updatedAt: '2026-10-11T10:00:00.000Z',
  ...over,
})

describe('isCompleted', () => {
  it('vrai à partir de 95 %', () => {
    expect(isCompleted(95, 100)).toBe(true)
    expect(isCompleted(94, 100)).toBe(false)
  })
  it('faux si la durée est inconnue', () => {
    expect(isCompleted(10, 0)).toBe(false)
  })
})

describe('resumePosition', () => {
  it('reprend là où on s\'est arrêté', () => {
    expect(resumePosition(progress({ position: 42 }))).toBe(42)
  })
  it('repart du début si terminée, absente ou à peine commencée', () => {
    expect(resumePosition(progress({ position: 42, completed: true }))).toBe(0)
    expect(resumePosition(undefined)).toBe(0)
    expect(resumePosition(progress({ position: 3 }))).toBe(0)
  })
})

describe('formatTime', () => {
  it('formate en m:ss puis h:mm:ss', () => {
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(754)).toBe('12:34')
    expect(formatTime(3725)).toBe('1:02:05')
  })
})
