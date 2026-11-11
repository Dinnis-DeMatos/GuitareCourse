import { useEffect, useRef, useState } from 'react'
import type { CourseFolder } from '../courseTypes.ts'
import { chooseTabsDir } from '../desktop.ts'
import { filterScores, listScores, tabUrl, type LibraryScore } from '../tabLibrary.ts'
import { Icon } from './Icon.tsx'
import { ScoreView, type ScoreControls } from './ScoreView.tsx'

const BACK_TO_LIST = { group: 'Tablatures', label: 'Revenir à la liste', icon: 'chevronLeft' } as const

/** Ce que le serveur répond : le dossier lu, null s'il n'est pas encore choisi, ou l'erreur de lecture. */
type Library = { tree: CourseFolder | null } | { error: string }

/**
 * Les tablatures rangées hors des cours : un dossier choisi une fois, dont les fichiers Guitar Pro (.gp,
 * .gpx) se lisent avec le même lecteur que dans les leçons. `start` : la partition à ouvrir d'emblée.
 */
export function TabLibrary({
  open,
  start = null,
  volume,
  onClose,
}: {
  open: boolean
  start?: LibraryScore | null
  volume: number
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const controls = useRef<ScoreControls>(null)
  const [library, setLibrary] = useState<Library | null>(null)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<LibraryScore | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      element.focus()
      if (start) setCurrent(start)
    }
    if (!open && element.open) element.close()
  }, [open, start])

  // Relu à chaque ouverture : les fichiers rangés entre-temps apparaissent.
  const load = () =>
    fetch('/api/tabs')
      .then(async (response) => {
        const body = await response.json()
        setLibrary(response.ok ? { tree: body as CourseFolder | null } : { error: body.error ?? `Erreur ${response.status}` })
      })
      .catch((e: unknown) => setLibrary({ error: String(e) }))
  useEffect(() => {
    if (open) void load()
  }, [open])

  // Le bouton cliqué disparaît avec la liste : le focus revient à la fenêtre, pour Espace et Échap.
  function show(score: LibraryScore | null) {
    setCurrent(score)
    dialog.current?.focus()
  }

  async function choose() {
    if (chooseTabsDir && (await chooseTabsDir())) {
      setQuery('')
      void load()
    }
  }

  const tree = library && 'tree' in library ? library.tree : null
  const scores = tree ? listScores(tree) : []
  const shown = filterScores(scores, query)
  const chooseButton = chooseTabsDir && (
    <button type="button" className="btn btn-solid" onClick={choose}>
      <Icon name="folder" />
      Choisir le dossier des tablatures
    </button>
  )

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="sheet trainer tablib"
      aria-labelledby="tablib-title"
      onClose={() => {
        setCurrent(null)
        onClose()
      }}
      onKeyDown={(event) => {
        if (!current) return
        // Échap revient d'abord à la liste ; Espace lance ou arrête la partition, sauf sur une commande.
        if (event.key === 'Escape') {
          event.preventDefault()
          show(null)
        }
        const target = event.target as HTMLElement
        if (event.key === ' ' && !target.closest('button, input, select')) {
          event.preventDefault()
          controls.current?.playPause()
        }
      }}
    >
      <div className="sheet-body">
        <div className="trainer-head">
          <div>
            <p className="sheet-kicker">{current ? (current.crumbs.join(' / ') || 'Tablatures') : 'Outil'}</p>
            <h2 id="tablib-title">{current ? current.file.title : 'Tablatures'}</h2>
          </div>
          <div className="tablib-actions">
            {!current && tree && chooseTabsDir && (
              <button type="button" className="btn" onClick={choose}>
                <Icon name="folder" />
                Changer de dossier
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              <Icon name="close" />
              Fermer
            </button>
          </div>
        </div>

        {open && current ? (
          <div className="tablib-score">
            <ScoreView
              url={tabUrl(current.file)}
              title={current.file.title}
              volume={volume}
              controlsRef={controls}
              back={BACK_TO_LIST}
              onClose={() => show(null)}
            />
          </div>
        ) : library === null ? (
          <p className="tablib-lead" role="status">
            Lecture du dossier…
          </p>
        ) : 'error' in library || tree === null ? (
          <div className="tablib-empty">
            <p className="tablib-lead">
              {'error' in library
                ? "Le dossier des tablatures n'a pas pu être lu : il a peut-être été déplacé ou renommé."
                : 'Choisissez le dossier où sont rangés vos fichiers Guitar Pro (.gp, .gpx) : ils apparaîtront ici, sous-dossiers compris.'}
            </p>
            {chooseButton ?? <p className="tablib-lead">Dans le navigateur, le dossier se règle par la variable TABS_DIR.</p>}
          </div>
        ) : scores.length === 0 ? (
          <div className="tablib-empty">
            <p className="tablib-lead">Aucun fichier .gp ou .gpx dans « {tree.name} ».</p>
          </div>
        ) : (
          <>
            <label htmlFor="tablib-search" className="silk">
              Rechercher dans « {tree.name} » · {scores.length} partition{scores.length > 1 ? 's' : ''}
            </label>
            <input
              id="tablib-search"
              type="search"
              className="chord-input tablib-search"
              value={query}
              placeholder="Titre ou dossier"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
            {shown.length === 0 ? (
              <p className="tablib-lead">Aucune partition ne correspond à « {query.trim()} ».</p>
            ) : (
              <ul className="tab-list tablib-list">
                {shown.map((score) => (
                  <li key={score.file.path}>
                    <button type="button" onClick={() => show(score)}>
                      <span className="tab-icon" aria-hidden="true">
                        <span>T</span>
                        <span>A</span>
                        <span>B</span>
                      </span>
                      <span>
                        <span className="tab-title">
                          {score.file.title} <span className="tablib-ext">.{score.file.ext}</span>
                        </span>
                        {score.crumbs.length > 0 && <span className="tablib-crumbs">{score.crumbs.join(' / ')}</span>}
                      </span>
                      <Icon name="play" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </dialog>
  )
}
