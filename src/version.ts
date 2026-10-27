import changelog from './changelog.json'

declare const __APP_VERSION__: string

/** Version de l'application (package.json), posée par Vite à la construction. */
export const APP_VERSION = __APP_VERSION__

export interface Release {
  version: string
  items: string[]
}

/** Compare deux versions « 1.6.1 » : négatif si `a` est plus ancienne. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/**
 * Les nouveautés à présenter après une mise à jour depuis `previous` : les versions plus récentes, jusqu'à
 * celle-ci. `previous` vide (version d'avant inconnue) : seulement celles de cette version.
 */
export function releasesSince(previous: string, current = APP_VERSION, releases: Release[] = changelog): Release[] {
  return releases.filter((r) =>
    previous === ''
      ? compareVersions(r.version, current) === 0
      : compareVersions(r.version, previous) > 0 && compareVersions(r.version, current) <= 0,
  )
}
