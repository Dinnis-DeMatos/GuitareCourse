import { useCallback, useState } from 'react'

function read<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
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
  const [value, setValue] = useState(() => read(key, fallback, isValid))
  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Tant pis : le réglage vaudra pour cette visite seulement.
      }
    },
    [key],
  )
  return [value, update]
}
