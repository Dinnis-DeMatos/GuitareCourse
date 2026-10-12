import type { CSSProperties } from 'react'
import type { ProgressMap } from '../courseTypes.ts'
import { finishAt, type Finish } from '../finishes.ts'
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
  expanded: ReadonlySet<string>
  favorites: ReadonlySet<string>
  onToggleGroup: (path: string) => void
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
 * l'ouvre) et son étoile de favori.
 */
export function LessonRow({
  lesson,
  depth,
  finish,
  parentName,
  actions,
}: {
  lesson: Lesson
  depth: number
  /** À préciser hors d'un chapitre (favoris, leçon seule au premier niveau). */
  finish?: Finish
  /** Nom du groupe sous lequel la leçon est affichée, s'il y en a un. */
  parentName?: string
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
  const { tabs, backingTracks } = resourceSummary(lesson)

  return (
    <li
      className="lesson-row"
      data-status={status}
      data-current={current ? 'true' : undefined}
      data-finish={finish?.id}
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
        <span className="lesson-title">{lesson.title}</span>
        {showContext && <span className="lesson-context">{lesson.context}</span>}
        {(tabs > 0 || backingTracks > 0) && (
          <span className="lesson-tags">
            {tabs > 0 && (
              <span className="tag" title={`${tabs} tablature${tabs > 1 ? 's' : ''}`}>
                Tab{tabs > 1 ? ` ${tabs}` : ''}
              </span>
            )}
            {backingTracks > 0 && (
              <span className="tag" title={`${backingTracks} backing track${backingTracks > 1 ? 's' : ''}`}>
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

/** Contenu d'un chapitre ou d'un sous-groupe : des leçons, et des groupes repliables. */
function Items({
  items,
  depth,
  parentName,
  actions,
}: {
  items: OutlineItem[]
  depth: number
  parentName: string
  actions: OutlineActions
}) {
  return (
    <ul className="items">
      {items.map((item) =>
        item.kind === 'lesson' ? (
          <LessonRow key={item.id} lesson={item} depth={depth} parentName={parentName} actions={actions} />
        ) : (
          <SubGroup key={item.path} group={item} depth={depth} actions={actions} />
        ),
      )}
    </ul>
  )
}

/** Un épisode (ou tout groupe à l'intérieur d'un chapitre) : une « frette » qui sépare les leçons. */
function SubGroup({ group, depth, actions }: { group: Group; depth: number; actions: OutlineActions }) {
  const open = actions.expanded.has(group.path)
  const { done, total } = countLessons(group.items, actions.progress)
  const { kicker, title } = splitName(group.name)
  return (
    <li className="group">
      <button
        type="button"
        className="group-head"
        style={depthStyle(depth)}
        aria-expanded={open}
        onClick={() => actions.onToggleGroup(group.path)}
      >
        {kicker && <span className="group-kicker">{kicker}</span>}
        <span className="group-title">{title}</span>
        <span className="group-count" title={`${done} leçon(s) terminée(s) sur ${total}`}>
          {done}/{total}
          <Icon name={open ? 'chevronDown' : 'chevronRight'} />
        </span>
      </button>
      {open && <Items items={group.items} depth={depth + 1} parentName={group.name} actions={actions} />}
    </li>
  )
}

/** Un chapitre : son titre, sa finition sur la tranche, et une frette par leçon. */
function Chapter({ group, finish, actions }: { group: Group; finish: Finish; actions: OutlineActions }) {
  const open = actions.expanded.has(group.path)
  const lessons = lessonsOf(group.items)
  const { done, total } = countLessons(group.items, actions.progress)
  const { kicker, title } = splitName(group.name)
  return (
    <li className="chapter" data-finish={finish.id}>
      <button
        type="button"
        className="band"
        aria-expanded={open}
        onClick={() => actions.onToggleGroup(group.path)}
      >
        {kicker && <span className="band-kicker">{kicker}</span>}
        <span className="band-title">{title}</span>
        <span className="band-count" title={`${done} leçon(s) terminée(s) sur ${total}`}>
          {done}/{total}
          <Icon name={open ? 'chevronDown' : 'chevronRight'} />
        </span>
        {lessons.length <= MAX_DOTS && (
          <span className="band-dots" aria-hidden="true">
            {lessons.map((lesson) => (
              <i key={lesson.id} data-status={statusOf(actions.progress[lesson.id])} />
            ))}
          </span>
        )}
      </button>
      {open && (
        <div className="chapter-body">
          <Items items={group.items} depth={0} parentName={group.name} actions={actions} />
        </div>
      )}
    </li>
  )
}

/**
 * Plan d'une méthode, lu comme un diagramme d'accord : les épisodes sont les frettes, et chaque leçon
 * est une note posée sur la corde.
 */
export function Outline({ items, actions }: { items: OutlineItem[]; actions: OutlineActions }) {
  return (
    <ul className="outline">
      {items.map((item, index) =>
        item.kind === 'lesson' ? (
          <LessonRow key={item.id} lesson={item} depth={0} finish={finishAt(index)} actions={actions} />
        ) : (
          <Chapter key={item.path} group={item} finish={finishAt(index)} actions={actions} />
        ),
      )}
    </ul>
  )
}
