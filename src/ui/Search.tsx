import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { AnnotationsMap, ChordProgression, CourseFolder } from '../courseTypes.ts'
import type { Course } from '../lessons.ts'
import { formatTime } from '../progress.ts'
import type { Routine } from '../routines.ts'
import { MAX_PER_KIND, search, type SearchHit, type SearchSources, type SearchTarget } from '../search.ts'
import { listScores } from '../tabLibrary.ts'
import type { Tone } from '../tones.ts'
import { CloseKey } from './CloseKey.tsx'
import { readOrNull } from '../media.ts'
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

/** Un exemple court tiré d'un titre : ses trois premiers mots. */
const sample = (title: string) => title.trim().split(/\s+/).slice(0, 3).join(' ')

type Tools = Pick<SearchSources, 'progressions' | 'routines' | 'tones' | 'scores'>
const NO_TOOLS: Tools = { progressions: null, routines: null, tones: null, scores: null }

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
  // Tiré à chaque ouverture : les exemples proposés changent d'une fois à l'autre.
  const [seed, setSeed] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      // Sans bloquer la page : la barre de navigation reste cliquable (voir panels.ts).
      element.show()
      setSeed(Math.random())
      // Relu à chaque ouverture : ce qu'on vient de ranger dans un outil se retrouve aussitôt.
      void Promise.all([
        readOrNull<ChordProgression[]>('/api/chords'),
        readOrNull<Routine[]>('/api/routines'),
        readOrNull<Tone[]>('/api/tones'),
        readOrNull<CourseFolder | null>('/api/tabs'),
      ]).then(([progressions, routines, tones, tabs]) =>
        setTools({ progressions, routines, tones, scores: tabs ? listScores(tabs) : null }),
      )
    }
    if (!open) {
      setQuery('')
      if (element.open) element.close()
    }
  }, [open])

  // Un clic à côté la ferme : il tombe sur le voile, dessiné par .shell (nav.css).
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if ((event.target as Element).classList.contains('shell')) onClose()
    }
    window.addEventListener('pointerdown', closeOutside)
    return () => window.removeEventListener('pointerdown', closeOutside)
  }, [open, onClose])

  // Tant qu'on n'a rien tapé : ce qu'on peut chercher, sorte par sorte, avec un exemple pris dans vos données.
  const kinds = useMemo(() => {
    const lessons = courses.flatMap((c) => c.lessons)
    const notes = Object.values(annotations).filter((a) => a.notes.trim() !== '')
    const marks = Object.values(annotations).flatMap((a) => a.bookmarks.map((b) => b.label).filter(Boolean))
    const titles: Record<SearchTarget['kind'], string[]> = {
      lesson: lessons.map((l) => l.title),
      note: notes.map((n) => n.notes),
      mark: marks,
      chords: tools.progressions?.map((p) => p.name) ?? [],
      routine: tools.routines?.map((r) => r.name) ?? [],
      tone: tools.tones?.map((t) => t.name) ?? [],
      tab: tools.scores?.map((s) => s.file.title) ?? [],
    }
    return (Object.keys(GROUPS) as SearchTarget['kind'][]).map((kind) => {
      const list = titles[kind].filter((t) => t.trim() !== '')
      return { kind, ...GROUPS[kind], count: list.length, example: list.length ? sample(list[Math.floor(seed * list.length)]) : null }
    })
  }, [courses, annotations, tools, seed])
  const examples = kinds.flatMap((k) => (k.example && k.kind !== 'note' ? [k.example] : []))
  // Le champ propose un exemple après l'autre tant qu'il est vide.
  useEffect(() => {
    if (!open || query !== '' || examples.length < 2) return
    const timer = setInterval(() => setTick((n) => n + 1), 2600)
    return () => clearInterval(timer)
  }, [open, query, examples.length])
  const placeholder = examples.length ? `Essayez « ${examples[tick % examples.length]} »` : 'Leçon, repère, routine, tablature…'

  /** Une sorte choisie dans l'accueil : son exemple est cherché aussitôt. */
  function tryKind(example: string | null) {
    if (example) setQuery(example)
    dialog.current?.querySelector('input')?.focus()
  }

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
    <dialog ref={dialog} className="search-panel search" aria-label="Rechercher" onClose={onClose}>
      <div className="sheet-body">
        <div className="search-field">
          <Icon name="search" />
          <input
            type="search"
            className="search-input"
            value={query}
            placeholder={placeholder}
            aria-label="Rechercher dans l'application"
            autoComplete="off"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && shown[0]) pick(shown[0])
              if (event.key === 'ArrowDown') move(event, 1)
            }}
          />
          <CloseKey onClick={onClose} />
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
            <div className="search-home">
              <p className="search-lead">Tout ce que vous avez rangé, d'un seul champ. Sans accents ni majuscules ; chaque mot doit y être.</p>
              <ul className="search-kinds">
                {kinds.map((kind, i) => (
                  <li key={kind.kind} style={{ '--i': i } as CSSProperties}>
                    <button type="button" disabled={kind.count === 0} onClick={() => tryKind(kind.kind === 'note' ? null : kind.example)}>
                      <Icon name={kind.icon} />
                      <span className="search-kind-label">{kind.label}</span>
                      <span className="search-kind-count">{kind.count}</span>
                      {kind.example && kind.kind !== 'note' && <span className="search-kind-example">« {kind.example} »</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="search-keys">
                <kbd>↑</kbd> <kbd>↓</kbd> pour parcourir · <kbd>Entrée</kbd> pour ouvrir le premier résultat
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="search-none">
              <Icon name="search" />
              <p>Rien ne correspond à « {query.trim()} ».</p>
              <span>Essayez un seul mot, ou un autre.</span>
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <section key={group.kind} aria-label={group.label}>
                  <h3 className="silk">{group.label}</h3>
                  <ul className="tablib-list search-list">
                    {group.hits.slice(0, MAX_PER_KIND).map((hit, i) => (
                      <li key={hit.key} style={{ '--i': i } as CSSProperties}>
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
