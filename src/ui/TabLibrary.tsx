import { useEffect, useRef, useState } from 'react'
import type { CourseFolder } from '../courseTypes.ts'
import { changeTabsDir, TABS_DIR_CHANGED } from '../desktop.ts'
import { filterScores, listScores, tabUrl, type LibraryScore } from '../tabLibrary.ts'
import { Icon } from './Icon.tsx'
import { ScoreSkeleton, ScoreView, type ScoreControls } from './ScoreView.tsx'

/** Ce que le serveur répond : le dossier lu, null s'il n'est pas encore choisi, ou l'erreur de lecture. */
type Library = { tree: CourseFolder | null } | { error: string }

/**
 * La page des tablatures rangées hors des cours : un dossier choisi une fois, dont les fichiers Guitar Pro
 * (.gp, .gpx) se lisent avec le même lecteur que dans les leçons. Deux colonnes : la liste (recherche
 * comprise) à gauche, la partition choisie à droite. `start` : la partition à ouvrir d'emblée.
 */
export function TabLibrary({
  open,
  start = null,
  volume,
}: {
  open: boolean
  start?: LibraryScore | null
  volume: number
}) {
  const page = useRef<HTMLElement>(null)
  const controls = useRef<ScoreControls>(null)
  const [library, setLibrary] = useState<Library | null>(null)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<LibraryScore | null>(null)

  // En quittant la page, la partition s'arrête ; on retrouve la liste seule à la prochaine visite.
  useEffect(() => {
    if (!open) return setCurrent(null)
    page.current?.focus()
    if (start) setCurrent(start)
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
  // Un autre dossier, choisi ici au premier passage ou depuis les options : on repart de sa liste.
  useEffect(() => {
    const reload = () => {
      setQuery('')
      setCurrent(null)
      void load()
    }
    window.addEventListener(TABS_DIR_CHANGED, reload)
    return () => window.removeEventListener(TABS_DIR_CHANGED, reload)
  }, [])

  // Le focus revient à la page : Espace lance ou arrête la partition qu'on vient de choisir.
  function show(score: LibraryScore) {
    setCurrent(score)
    page.current?.focus()
  }

  const tree = library && 'tree' in library ? library.tree : null
  const scores = tree ? listScores(tree) : []
  const shown = filterScores(scores, query)
  // Le premier choix du dossier se fait ici ; en changer se fait dans les options (Profil).
  const chooseButton = changeTabsDir && (
    <button type="button" className="btn btn-solid" onClick={() => void changeTabsDir?.()}>
      <Icon name="folder" />
      Choisir le dossier des tablatures
    </button>
  )

  return (
    <section
      ref={page}
      tabIndex={-1}
      hidden={!open}
      className="page tablib"
      aria-labelledby="tablib-title"
      onKeyDown={(event) => {
        if (!current) return
        // Espace lance ou arrête la partition, sauf sur une commande.
        const target = event.target as HTMLElement
        if (event.key === ' ' && !target.closest('button, input, select')) {
          event.preventDefault()
          controls.current?.playPause()
        }
      }}
    >
      <div className="sheet-body">
        <div className="trainer-head">
          <h2 id="tablib-title">Tablatures</h2>
        </div>

        {library === null ? (
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
          <div className="tablib-layout">
            <div className="tablib-index">
              <label htmlFor="tablib-search" className="silk">
                Rechercher dans « {tree.name} » · {scores.length} tablature{scores.length > 1 ? 's' : ''}
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
                <p className="tablib-lead">Aucune tablature ne correspond à « {query.trim()} ».</p>
              ) : (
                <ul className="tab-list tablib-list">
                  {shown.map((score) => (
                    <li key={score.file.path}>
                      <button
                        type="button"
                        aria-current={current?.file.path === score.file.path ? 'true' : undefined}
                        onClick={() => show(score)}
                      >
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
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="tablib-view">
              {open && current ? (
                <>
                  {current.crumbs.length > 0 && <p className="silk routines-total">{current.crumbs.join(' / ')}</p>}
                  <h3 className="routines-title">
                    {current.file.title} <span className="tablib-ext">.{current.file.ext}</span>
                  </h3>
                  <div className="tablib-score">
                    <ScoreView key={current.file.path} url={tabUrl(current.file)} title={current.file.title} volume={volume} controlsRef={controls} back={null} />
                  </div>
                </>
              ) : (
                <>
                  {/* À la place du titre et de la tablature : la consigne, sur une tablature esquissée qui attend. */}
                  <h3 className="routines-title tablib-waiting">Choisissez une tablature dans la liste</h3>
                  <div className="tablib-score tablib-placeholder">
                    <ScoreSkeleton />
                    <p className="tablib-placeholder-text">Elle s'affiche ici, prête à jouer.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
