import { useEffect, useState } from 'react'
import type { Theme } from '../App.tsx'
import { chooseCoursesDir } from '../desktop.ts'
import { usePersistentState } from '../usePersistentState.ts'
import { BackupsDialog } from './Backups.tsx'
import { Icon } from './Icon.tsx'

/** Les couleurs proposées : des finitions de guitares. La première, celle du logo, est la couleur par défaut. */
const ACCENTS = [
  { id: 'fiesta', name: 'Fiesta Red' },
  { id: 'surf', name: 'Surf Green' },
  { id: 'butterscotch', name: 'Butterscotch' },
  { id: 'daphne', name: 'Daphne Blue' },
  { id: 'shell', name: 'Shell Pink' },
  { id: 'turquoise', name: 'Ocean Turquoise' },
] as const
type Accent = (typeof ACCENTS)[number]['id']
const isAccent = (value: unknown): value is Accent => ACCENTS.some((accent) => accent.id === value)

/**
 * Le bouton Options et son menu, dans le plan comme sur l'accueil (un seul des deux est affiché à la fois) ;
 * il porte aussi la fenêtre des sauvegardes.
 */
export function Options({
  theme,
  onToggleTheme,
  onHelp,
  onRefreshCourses,
}: {
  theme: Theme
  onToggleTheme: () => void
  onHelp: () => void
  /** Relit le dossier des cours. */
  onRefreshCourses: () => Promise<void>
}) {
  const themeLabel = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'
  const closeOptions = () => document.getElementById('options-menu')?.hidePopover()
  const [backupsOpen, setBackupsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Clé lue aussi par index.html, qui pose la couleur avant le premier affichage.
  const [accent, setAccent] = usePersistentState<Accent>('guitarecourse.accent', 'fiesta', isAccent)
  useEffect(() => {
    if (accent === 'fiesta') delete document.documentElement.dataset.accent
    else document.documentElement.dataset.accent = accent
  }, [accent])

  return (
    <>
      <button type="button" className="btn options-button" popoverTarget="options-menu">
        <Icon name="settings" />
        Options
      </button>
      {/* Se ferme d'un clic à côté ou avec Échap ; le thème le laisse ouvert pour voir le changement. */}
      <div id="options-menu" popover="auto" className="options-menu">
        {chooseCoursesDir && (
          <button type="button" onClick={() => (closeOptions(), chooseCoursesDir?.())}>
            <Icon name="folder" />
            Changer le dossier du cours
          </button>
        )}
        {/* Le menu reste ouvert le temps de la relecture : on voit qu'elle a lieu, puis il se ferme. */}
        <button
          type="button"
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={() => {
            setRefreshing(true)
            void onRefreshCourses().finally(() => {
              setRefreshing(false)
              closeOptions()
            })
          }}
        >
          {refreshing ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" />}
          {refreshing ? 'Actualisation…' : 'Actualiser les cours'}
        </button>
        <button type="button" onClick={() => (closeOptions(), setBackupsOpen(true))}>
          <Icon name="backup" />
          Sauvegardes
        </button>
        {/* Comme le thème, la couleur laisse le menu ouvert : on voit le changement. */}
        <div className="options-colors" role="group" aria-label="Couleur de l'application">
          <span className="silk">Couleur</span>
          <span className="swatches">
            {ACCENTS.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                className="swatch"
                style={{ background: `var(--${id})` }}
                aria-pressed={accent === id}
                aria-label={name}
                title={name}
                onClick={() => setAccent(id)}
              />
            ))}
          </span>
        </div>
        <button type="button" onClick={onToggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          {themeLabel}
        </button>
        <button type="button" onClick={() => (closeOptions(), onHelp())}>
          <span className="tool-key">?</span>
          Guide et raccourcis
        </button>
      </div>
      <BackupsDialog open={backupsOpen} onClose={() => setBackupsOpen(false)} />
    </>
  )
}
