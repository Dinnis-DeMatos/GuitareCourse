import { useState } from 'react'
import type { Theme } from '../App.tsx'
import { chooseCoursesDir } from '../desktop.ts'
import { BackupsDialog } from './Backups.tsx'
import { Icon } from './Icon.tsx'

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
