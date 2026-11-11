import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AnnotationsMap, ChordProgression, CourseFolder } from '../courseTypes.ts'
import type { Course } from '../lessons.ts'
import { formatTime } from '../progress.ts'
import type { Routine } from '../routines.ts'
import { MAX_PER_KIND, search, type SearchHit, type SearchSources, type SearchTarget } from '../search.ts'
import { listScores } from '../tabLibrary.ts'
import type { Tone } from '../tones.ts'
import { Icon, type IconName } from './Icon.tsx'

const GROUPS: Record<SearchTarget['kind'], { label: string; icon: IconName }> = {
  lesson: { label: 'Leçons', icon: 'play' },
  note: { label: 'Notes', icon: 'note' },
  mark: { label: 'Repères', icon: 'repeatStart' },
  chords: { label: "Suites d'accords", icon: 'chord' },
  routine: { label: 'Routines', icon: 'routine' },
  tone: { label: 'Sons', icon: 'amp' },
  tab: { label: 'Tablatures', icon: 'note' },
}

/** Ce que fait le résultat, dit à sa droite. */
function actionOf(target: SearchTarget): string {
  switch (target.kind) {
    case 'mark':
      return formatTime(target.mark.time)
    case 'chords':
      return 'Jouer'
    case 'routine':
      return 'Lancer'
    default:
      return 'Ouvrir'
  }
}

type Tools = Pick<SearchSources, 'progressions' | 'routines' | 'tones' | 'scores'>
const NO_TOOLS: Tools = { progressions: null, routines: null, tones: null, scores: null }

const get = <T,>(url: string) =>
  fetch(url).then((response) => (response.ok ? (response.json() as Promise<T>) : null)).catch(() => null)

/** Fenêtre de recherche (Ctrl+K) : leçons, notes, repères et tout ce qu'on a rangé dans les outils. */
export function Search({
  open,
  courses,
  annotations,
  onPick,
  onClose,
}: {
  open: boolean
  courses: Course[]
  annotations: AnnotationsMap
  onPick: (target: SearchTarget) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [tools, setTools] = useState<Tools>(NO_TOOLS)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      // Relu à chaque ouverture : ce qu'on vient de ranger dans un outil se retrouve aussitôt.
      void Promise.all([
        get<ChordProgression[]>('/api/chords'),
        get<Routine[]>('/api/routines'),
        get<Tone[]>('/api/tones'),
        get<CourseFolder | null>('/api/tabs'),
      ]).then(([progressions, routines, tones, tabs]) =>
        setTools({ progressions, routines, tones, scores: tabs ? listScores(tabs) : null }),
      )
    }
    if (!open) {
      setQuery('')
      if (element.open) element.close()
    }
  }, [open])

  const hits = open ? search({ courses, annotations, ...tools }, query) : []
  const groups = Object.entries(GROUPS)
    .map(([kind, group]) => ({ kind, ...group, hits: hits.filter((hit) => hit.target.kind === kind) }))
    .filter((group) => group.hits.length > 0)
  const shown = groups.flatMap((group) => group.hits.slice(0, MAX_PER_KIND))

  const pick = (hit: SearchHit) => onPick(hit.target)

  /** Flèches haut et bas : d'un résultat à l'autre, et retour au champ depuis le premier. */
  function move(event: KeyboardEvent, step: number) {
    const buttons = [...(list.current?.querySelectorAll('button') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = at + step
    event.preventDefault()
    if (next < 0) dialog.current?.querySelector('input')?.focus()
    else buttons[Math.min(next, buttons.length - 1)]?.focus()
  }

  return (
    <dialog ref={dialog} className="sheet search" aria-label="Rechercher" onClose={onClose}>
      <div className="sheet-body">
        <div className="search-field">
          <Icon name="search" />
          <input
            type="search"
            className="search-input"
            value={query}
            placeholder="Leçon, note, repère, suite d'accords, routine, son, tablature…"
            aria-label="Rechercher dans l'application"
            autoComplete="off"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && shown[0]) pick(shown[0])
              if (event.key === 'ArrowDown') move(event, 1)
            }}
          />
          <button type="button" className="btn" onClick={onClose} title="Fermer (Échap)">
            <Icon name="close" />
            Fermer
          </button>
        </div>

        <div
          ref={list}
          className="search-results"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') move(event, 1)
            if (event.key === 'ArrowUp') move(event, -1)
          }}
        >
          {query.trim() === '' ? (
            <p className="search-lead">Tapez un mot : sans accents ni majuscules, chaque mot doit y être.</p>
          ) : hits.length === 0 ? (
            <p className="search-lead">Rien ne correspond à « {query.trim()} ».</p>
          ) : (
            <>
              {groups.map((group) => (
                <section key={group.kind} aria-label={group.label}>
                  <h3 className="silk">{group.label}</h3>
                  <ul className="tablib-list search-list">
                    {group.hits.slice(0, MAX_PER_KIND).map((hit) => (
                      <li key={hit.key}>
                        <button type="button" onClick={() => pick(hit)}>
                          <Icon name={group.icon} />
                          <span>
                            <span className="tab-title">{hit.title}</span>
                            {hit.detail && <span className="tablib-crumbs">{hit.detail}</span>}
                          </span>
                          <span className="search-action">{actionOf(hit.target)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {group.hits.length > MAX_PER_KIND && (
                    <p className="search-more">
                      Et {group.hits.length - MAX_PER_KIND} autres : ajoutez un mot pour affiner.
                    </p>
                  )}
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
