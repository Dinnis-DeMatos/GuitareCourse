import { describe, expect, it } from 'vitest'
import { compareVersions, releasesSince } from './version.ts'

const releases = [
  { version: '1.10.0', items: ['c'] },
  { version: '1.6.1', items: ['b'] },
  { version: '1.6.0', items: ['a'] },
]

describe('versions', () => {
  it('compare chiffre par chiffre', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.6.0', '1.6.1')).toBeLessThan(0)
    expect(compareVersions('1.6.1', '1.6.1')).toBe(0)
  })

  it('présente les versions sautées, sans celles à venir', () => {
    expect(releasesSince('1.6.0', '1.6.1', releases).map((r) => r.version)).toEqual(['1.6.1'])
    expect(releasesSince('1.5.0', '1.10.0', releases).map((r) => r.version)).toEqual(['1.10.0', '1.6.1', '1.6.0'])
  })

  it("version d'avant inconnue : seulement celle-ci", () => {
    expect(releasesSince('', '1.6.1', releases).map((r) => r.version)).toEqual(['1.6.1'])
  })
})
