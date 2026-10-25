import { useCallback, useState } from 'react'

/** Réglage mémorisé dans ce navigateur, ou `fallback` s'il est absent, invalide ou illisible. */
export function readSetting<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    return isValid(value) ? value : fallback
  } catch {
    // Stockage indisponible (navigation privée, données bloquées…) ou valeur abîmée.
    return fallback
  }
}

/** Mémorise un réglage ; sans stockage disponible, il ne vaut que pour cette visite. */
export function writeSetting<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Tant pis : le réglage vaudra pour cette visite seulement.
  }
}

/**
 * Réglage de confort mémorisé dans ce navigateur (le volume, par exemple). L'application fonctionne
 * à l'identique si le stockage est indisponible : le réglage repart simplement de sa valeur de départ.
 * Les données du cours (progression, favoris, notes), elles, sont enregistrées par le serveur.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState(() => readSetting(key, fallback, isValid))
  const update = useCallback(
    (next: T) => {
      setValue(next)
      writeSetting(key, next)
    },
    [key],
  )
  return [value, update]
}
