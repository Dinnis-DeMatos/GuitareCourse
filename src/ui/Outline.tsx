import { useEffect, useState, type CSSProperties } from 'react'
import type { ProgressMap } from '../courseTypes.ts'
import {
  countLessons,
  lessonsOf,
  resourceSummary,
  splitName,
  type Group,
  type Lesson,
  type OutlineItem,
} from '../lessons.ts'
import { statusOf, type LessonStatus } from '../progress.ts'
import { Icon } from './Icon.tsx'

/** Ce dont le plan a besoin pour afficher l'état des leçons et réagir aux clics. */
export interface OutlineActions {
  currentId: string | null
  progress: ProgressMap
  favorites: ReadonlySet<string>
  onSelect: (lesson: Lesson) => void
  onToggleDone: (lesson: Lesson) => void
  onToggleFavorite: (lesson: Lesson) => void
}

const STATUS_LABEL: Record<LessonStatus, string> = {
  done: 'terminée',
  started: 'en cours',
  new: 'pas commencée',
}

/** Au-delà, les frettes d'un chapitre deviendraient illisibles : le compteur suffit. */
const MAX_DOTS = 40

function depthStyle(depth: number): CSSProperties {
  return { '--depth': depth } as CSSProperties
}

/**
 * Une leçon : sa « note » posée sur la corde (cliquer la coche ou la décoche), son titre (cliquer
 * l'ouvre) et son étoile de favori. `compact` (dans le plan) : une seule ligne, la partie réduite à sa
 * lettre (« E ») et les tablatures et backing tracks en petites icônes.
 */
export function LessonRow({
  lesson,
  depth,
  parentName,
  compact = false,
  actions,
}: {
  lesson: Lesson
  depth: number
  /** Nom du groupe sous lequel la leçon est affichée, s'il y en a un. */
  parentName?: string
  compact?: boolean
  actions: OutlineActions
}) {
  const { currentId, progress, favorites, onSelect, onToggleDone, onToggleFavorite } = actions
  const status = statusOf(progress[lesson.id])
  const current = lesson.id === currentId
  const favorite = favorites.has(lesson.id)
  // Le dossier de la leçon n'est rappelé que s'il apprend quelque chose : ni quand il répète le
  // titre, ni quand c'est le groupe affiché juste au-dessus.
  const showContext =
    lesson.context !== parentName && splitName(lesson.context).title.toLowerCase() !== lesson.title.toLowerCase()
  // Dans le plan, « Partie E · Fais encore marcher… » (ou « Partie 2 ») se réduit à « E » devant le titre.
  const part = lesson.context.match(/^Partie (\S+?)(?: · |$)/)?.[1]
  const marker = compact && showContext && part ? part : null
  const { tabs, backingTracks } = resourceSummary(lesson)
  const tabsLabel = `${tabs} tablature${tabs > 1 ? 's' : ''}`
  const backingLabel = `${backingTracks} backing track${backingTracks > 1 ? 's' : ''}`

  return (
    <li
      className="lesson-row"
      data-status={status}
      data-current={current ? 'true' : undefined}
      data-compact={compact || undefined}
      style={depthStyle(depth)}
    >
      <button
        type="button"
        className="note-btn"
        aria-pressed={status === 'done'}
        aria-label={`${lesson.title} : ${STATUS_LABEL[status]}`}
        title={status === 'done' ? 'Décocher : marquer comme non terminée' : 'Cocher : marquer comme terminée'}
        onClick={() => onToggleDone(lesson)}
      >
        <span className="note">
          <Icon name="check" />
        </span>
      </button>
      <button
        type="button"
        className="lesson"
        aria-current={current ? 'true' : undefined}
        onClick={() => onSelect(lesson)}
      >
        <span className="lesson-title">
          {marker && (
            <span className="lesson-marker" title={lesson.context}>
              {marker}
            </span>
          )}
          {lesson.title}
          {compact && tabs > 0 && (
            <span className="lesson-has" title={tabsLabel} aria-label={tabsLabel}>
              <Icon name="note" />
            </span>
          )}
          {compact && backingTracks > 0 && (
            <span className="lesson-has" title={backingLabel} aria-label={backingLabel}>
              <Icon name="volume" />
            </span>
          )}
        </span>
        {showContext && !marker && <span className="lesson-context">{lesson.context}</span>}
        {!compact && (tabs > 0 || backingTracks > 0) && (
          <span className="lesson-tags">
            {tabs > 0 && (
              <span className="tag" title={tabsLabel}>
                Tab{tabs > 1 ? ` ${tabs}` : ''}
              </span>
            )}
            {backingTracks > 0 && (
              <span className="tag" title={backingLabel}>
                Backing {backingTracks}
              </span>
            )}
          </span>
        )}
      </button>
      <button
        type="button"
        className="star"
        aria-pressed={favorite}
        aria-label={`${lesson.title} : ${favorite ? 'retirer des favoris' : 'ajouter aux favoris'}`}
        title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        onClick={() => onToggleFavorite(lesson)}
      >
        <Icon name={favorite ? 'starFilled' : 'star'} />
      </button>
    </li>
  )
}

/**
 * Le contenu d'un épisode ou d'une partie, en retrait sous son titre : ses leçons, et ses parties (une
 * partie de plusieurs leçons a son propre titre, et ses leçons un retrait de plus).
 */
function Branch({ items, parentName, actions }: { items: OutlineItem[]; parentName: string; actions: OutlineActions }) {
  return (
    <ul className="items branch">
      {items.map((item) =>
        item.kind === 'lesson' ? (
          <LessonRow key={item.id} lesson={item} depth={0} parentName={parentName} compact actions={actions} />
        ) : (
          <Part key={item.path} group={item} actions={actions} />
        ),
      )}
    </ul>
  )
}

/**
 * Une partie de plusieurs leçons, dans un épisode : une ligne comme les autres parties (« F Il est
 * temps de mélanger tout ça »), puis ses leçons en retrait sous elle.
 */
function Part({ group, actions }: { group: Group; actions: OutlineActions }) {
  const { done, total } = countLessons(group.items, actions.progress)
  const { kicker, title } = splitName(group.name)
  const marker = kicker?.match(/^Partie (\S+)$/)?.[1] ?? kicker
  return (
    <li className="part">
      <div className="part-head" data-done={(total > 0 && done === total) || undefined}>
        <span className="part-node" aria-hidden="true" />
        <span className="lesson-title">
          {marker && <span className="lesson-marker">{marker}</span>}
          {title}
        </span>
        <span className="group-count" title={`${done} leçon(s) terminée(s) sur ${total}`}>
          {done}/{total}
        </span>
      </div>
      <Branch items={group.items} parentName={group.name} actions={actions} />
    </li>
  )
}

/** Un épisode du chapitre ouvert : son titre, puis ses parties et leçons en retrait. */
function Episode({ group, actions }: { group: Group; actions: OutlineActions }) {
  const { done, total } = countLessons(group.items, actions.progress)
  const { kicker, title } = splitName(group.name)
  return (
    <li className="episode">
      <div className="episode-head">
        {kicker && <span className="group-kicker">{kicker}</span>}
        <span className="group-title">{title}</span>
        <span className="group-count" title={`${done} leçon(s) terminée(s) sur ${total}`}>
          {done}/{total}
        </span>
      </div>
      <Branch items={group.items} parentName={group.name} actions={actions} />
    </li>
  )
}

/** Le chapitre ouvert : son titre, sa progression en frettes, puis ses leçons et ses épisodes. */
function Chapter({ item, actions }: { item: OutlineItem; actions: OutlineActions }) {
  if (item.kind === 'lesson') {
    return (
      <ul className="outline">
        <LessonRow lesson={item} depth={0} compact actions={actions} />
      </ul>
    )
  }
  const lessons = lessonsOf(item.items)
  const { done, total } = countLessons(item.items, actions.progress)
  const { kicker, title } = splitName(item.name)
  return (
    <div className="chapter-panel">
      <div className="band">
        <span className="band-kicker">
          {kicker ?? 'Chapitre'} · {done}/{total}
        </span>
        <span className="band-title">{title}</span>
        {lessons.length <= MAX_DOTS && (
          <span className="band-dots" aria-hidden="true">
            {lessons.map((lesson) => (
              <i key={lesson.id} data-status={statusOf(actions.progress[lesson.id])} />
            ))}
          </span>
        )}
      </div>
      <ul className="outline">
        {item.items.map((child) =>
          child.kind === 'lesson' ? (
            <LessonRow key={child.id} lesson={child} depth={0} parentName={item.name} compact actions={actions} />
          ) : (
            <Episode key={child.path} group={child} actions={actions} />
          ),
        )}
      </ul>
    </div>
  )
}

/** Le numéro d'un chapitre sur le rail : celui de son nom (« Chapitre 3 »), sinon sa place. */
function railLabel(item: OutlineItem, index: number): string {
  const kicker = item.kind === 'group' ? splitName(item.name).kicker : null
  return kicker?.match(/\d+/)?.[0] ?? String(index)
}

/** Le chapitre (élément de premier niveau) qui contient la leçon ; -1 s'il n'y en a pas. */
function chapterOf(items: OutlineItem[], id: string | null): number {
  return items.findIndex((item) => (item.kind === 'lesson' ? item.id === id : lessonsOf(item.items).some((l) => l.id === id)))
}

/**
 * Plan d'une méthode : à gauche, un rail avec un numéro par chapitre (sa progression en jauge) ; à
 * côté, le seul chapitre ouvert, épisodes en titres et une ligne par leçon. Le chapitre ouvert suit la
 * leçon en cours ; le rail permet d'aller voir les autres.
 */
export function Outline({ items, actions }: { items: OutlineItem[]; actions: OutlineActions }) {
  const current = chapterOf(items, actions.currentId)
  const [open, setOpen] = useState(Math.max(0, current))
  useEffect(() => {
    if (current >= 0) setOpen(current)
  }, [current])

  // Une méthode sans chapitres (des leçons à plat) n'a pas besoin de rail.
  if (!items.some((item) => item.kind === 'group')) {
    return (
      <ul className="outline">
        {items.map((item) =>
          item.kind === 'lesson' ? <LessonRow key={item.id} lesson={item} depth={0} compact actions={actions} /> : null,
        )}
      </ul>
    )
  }

  const shown = items[Math.min(open, items.length - 1)]
  return (
    <div className="course-map">
      <ol className="rail" aria-label="Chapitres">
        {items.map((item, index) => {
          const { done, total } = countLessons(item.kind === 'lesson' ? [item] : item.items, actions.progress)
          const name = item.kind === 'lesson' ? item.title : item.name
          return (
            <li key={item.kind === 'lesson' ? item.id : item.path}>
              <button
                type="button"
                className="rail-chapter"
                aria-pressed={index === open}
                data-here={index === current || undefined}
                title={`${name} · ${done}/${total}`}
                aria-label={`${name} : ${done} leçon${done > 1 ? 's' : ''} terminée${done > 1 ? 's' : ''} sur ${total}`}
                style={{ '--p': total > 0 ? done / total : 0 } as CSSProperties}
                onClick={() => setOpen(index)}
              >
                {railLabel(item, index)}
              </button>
            </li>
          )
        })}
      </ol>
      <Chapter key={open} item={shown} actions={actions} />
    </div>
  )
}
