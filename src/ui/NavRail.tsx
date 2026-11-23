import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Page, Theme } from '../App.tsx'
import type { ChordProgression, ProgressMap } from '../courseTypes.ts'
import type { Course, Lesson } from '../lessons.ts'
import type { Routine, RoutineRun } from '../routines.ts'
import type { Tone } from '../tones.ts'
import { readOrNull } from '../media.ts'
import { Icon, type IconName } from './Icon.tsx'
import type { JournalSources } from '../journal.ts'
import { Journal } from './Journal.tsx'
import { Options } from './Options.tsx'
import { closeOnEscape, openPanels, replacePanels, requestClose } from './panels.ts'

/** Les quatre outils de la roue, dans le sens des aiguilles d'une montre depuis le haut. */
type Tool = { icon: IconName; label: string; open: () => void }

interface JournalData {
  trainer: JournalSources['trainer']
  chords: ChordProgression[] | null
  tones: Tone[] | null
  routines: Routine[] | null
  runs: RoutineRun[] | null
}

/**
 * La barre de gauche, sur toutes les pages : l'accueil, les cours, les routines et les tablatures ; tout en
 * bas, la recherche, la roue des outils, puis le profil (parcours et options).
 */
export function NavRail({
  page,
  onHome,
  onSearch,
  onCourses,
  tools,
  onRoutines,
  onTabs,
  courses,
  progress,
  onOpenLesson,
  theme,
  onToggleTheme,
  onHelp,
  onRefreshCourses,
}: {
  /** La page affichée, mise en avant dans la barre. */
  page: Page
  onHome: () => void
  /** Ouvre la recherche (Ctrl+K). */
  onSearch: () => void
  onCourses: () => void
  tools: Tool[]
  onRoutines: () => void
  onTabs: () => void
  courses: Course[]
  progress: ProgressMap | null
  onOpenLesson: (lesson: Lesson) => void
  theme: Theme
  onToggleTheme: () => void
  onHelp: () => void
  onRefreshCourses: () => Promise<void>
}) {
  // Quand on a ouvert le parcours : le rouvrir pendant qu'il se replie en crée un nouveau.
  const [journal, setJournal] = useState<number | null>(null)
  const [data, setData] = useState<JournalData | null>(null)

  const openJournal = () => {
    setJournal(Date.now())
    // Relu à chaque ouverture : une séance ou une routine vient peut-être d'être faite.
    void Promise.all([
      readOrNull<{ sessions: JournalSources['trainer'] }>('/api/trainer'),
      readOrNull<ChordProgression[]>('/api/chords'),
      readOrNull<Tone[]>('/api/tones'),
      readOrNull<Routine[]>('/api/routines'),
      readOrNull<RoutineRun[]>('/api/routine-runs'),
    ]).then(([trainer, chords, tones, routines, runs]) =>
      setData({ trainer: trainer?.sessions ?? null, chords, tones, routines, runs }),
    )
  }

  const closeWheel = () => document.getElementById('tool-wheel')?.hidePopover()

  // Les fenêtres d'outil ne bloquent pas la page : Échap les ferme ici, et un clic dans la barre les
  // referme avant d'agir, comme la roue et le menu du profil (sauf un clic dans une fenêtre ouverte depuis
  // la barre elle-même : parcours, sauvegardes…).
  useEffect(() => {
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])
  const closePanels = (event: PointerEvent) => {
    // La roue, le profil (et leurs menus) et la recherche remplacent l'outil ouvert seulement au moment
    // d'ouvrir le suivant (replacePanels) : le voile reste.
    if ((event.target as HTMLElement).closest('dialog, [popover], .rail-tools, .rail-search, .rail-profile')) return
    openPanels().forEach(requestClose)
  }

  // Le repère de la page affichée : un seul trait de couleur, qui glisse d'une entrée à l'autre. On le
  // place sur le bouton de la page (en colonne à gauche, ou en rangée en bas sur écran étroit).
  const rail = useRef<HTMLElement>(null)
  const [marker, setMarker] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const current = rail.current?.querySelector<HTMLElement>('.rail-item[aria-current="page"]')
      setMarker(current ? { x: current.offsetLeft, y: current.offsetTop, w: current.offsetWidth, h: current.offsetHeight } : null)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [page])
  // Pas de glissade à l'arrivée : le repère apparaît d'abord à sa place.
  const [moved, setMoved] = useState(false)
  const [first] = useState(page)
  if (!moved && page !== first) setMoved(true)

  return (
    <nav ref={rail} className="rail" aria-label="Navigation" onPointerDownCapture={closePanels}>
      {marker && (
        <span
          className="rail-marker"
          data-moving={moved || undefined}
          aria-hidden="true"
          style={{ '--x': `${marker.x}px`, '--y': `${marker.y}px`, '--w': `${marker.w}px`, '--h': `${marker.h}px` } as CSSProperties}
        />
      )}
      <button type="button" className="rail-item rail-brand" onClick={onHome} aria-current={page === 'home' ? 'page' : undefined}>
        <Icon name="pick" />
        <span>Accueil</span>
      </button>
      <button type="button" className="rail-item" onClick={onCourses} aria-current={page === 'courses' ? 'page' : undefined}>
        <Icon name="lessons" />
        <span>Cours</span>
      </button>
      <button type="button" className="rail-item" onClick={onRoutines} aria-current={page === 'routines' ? 'page' : undefined}>
        <Icon name="routine" />
        <span>Routines</span>
      </button>
      <button type="button" className="rail-item" onClick={onTabs} aria-current={page === 'tabs' ? 'page' : undefined}>
        <Icon name="note" />
        <span>Tablatures</span>
      </button>

      <button type="button" className="rail-item rail-search" onClick={() => replacePanels(onSearch)} title="Rechercher (Ctrl+K)">
        <Icon name="search" />
        <span>Rechercher</span>
      </button>
      <button type="button" className="rail-item rail-tools" popoverTarget="tool-wheel">
        <Icon name="tools" />
        <span>Outils</span>
      </button>
      {/* La roue : les outils posés sur un cercle, comme les potards d'un ampli. Échap ou un clic à côté la ferment. */}
      <div id="tool-wheel" popover="auto" className="wheel" aria-label="Outils">
        <div className="wheel-ring" style={{ '--count': tools.length } as CSSProperties}>
          {tools.map(({ icon, label, open }, i) => (
            <button
              key={label}
              type="button"
              className="wheel-tool"
              style={{ '--i': i } as CSSProperties}
              onClick={() => {
                closeWheel()
                replacePanels(open)
              }}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
          <span className="wheel-hub" aria-hidden="true">
            <Icon name="pick" />
          </span>
        </div>
      </div>

      <Options
        theme={theme}
        onToggleTheme={onToggleTheme}
        onHelp={onHelp}
        onRefreshCourses={onRefreshCourses}
        onJournal={openJournal}
      />

      {journal !== null && (
        <Journal
          key={journal}
          courses={courses}
          progress={progress}
          trainer={data?.trainer ?? null}
          chords={data?.chords ?? null}
          tones={data?.tones ?? null}
          routines={data?.routines ?? null}
          runs={data?.runs ?? null}
          onOpenLesson={onOpenLesson}
          onClose={() => {
            // shortcut: 400 ms, la durée de fermeture des fenêtres (dialog.css) ; à garder ensemble.
            const closing = journal
            window.setTimeout(() => setJournal((j) => (j === closing ? null : j)), 400)
          }}
        />
      )}
    </nav>
  )
}
