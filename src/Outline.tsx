import type { ProgressMap } from './courseTypes.ts'
import { countLessons, resourceSummary, splitName, type Lesson, type OutlineItem } from './lessons.ts'

interface OutlineProps {
  items: OutlineItem[]
  currentId: string | null
  progress: ProgressMap
  expanded: ReadonlySet<string>
  onToggleGroup: (path: string) => void
  onSelect: (lesson: Lesson) => void
  onToggleDone: (lesson: Lesson) => void
  favorites: ReadonlySet<string>
  onToggleFavorite: (lesson: Lesson) => void
}

function statusOf(lesson: Lesson, progress: ProgressMap): 'done' | 'started' | 'new' {
  const entry = progress[lesson.id]
  if (entry?.completed) return 'done'
  return entry && entry.position > 0 ? 'started' : 'new'
}

const STATUS_LABEL = { done: 'Terminée', started: 'En cours', new: 'Pas commencée' } as const

/** Plan du cours : groupes repliables et leçons, avec l'état de chacune. */
export function Outline(props: OutlineProps) {
  const { items, currentId, progress, expanded, onToggleGroup, onSelect, onToggleDone, favorites, onToggleFavorite } =
    props
  return (
    <ul className="outline">
      {items.map((item) => {
        if (item.kind === 'lesson') {
          const status = statusOf(item, progress)
          const subtitle = splitName(item.context).title
          const showSubtitle = subtitle.toLowerCase() !== item.title.toLowerCase()
          const { tabs, backingTracks } = resourceSummary(item)
          return (
            <li key={item.id} className="lesson-row" data-current={item.id === currentId}>
              <button
                type="button"
                className="check"
                aria-pressed={status === 'done'}
                aria-label={`${item.title} : ${STATUS_LABEL[status].toLowerCase()}`}
                title={status === 'done' ? 'Décocher : marquer comme non terminée' : 'Cocher : marquer comme terminée'}
                onClick={() => onToggleDone(item)}
              >
                <span className={`status status-${status}`} />
              </button>
              <button
                type="button"
                className="lesson"
                aria-current={item.id === currentId ? 'true' : undefined}
                onClick={() => onSelect(item)}
              >
                <span className="lesson-text">
                  <span className="lesson-title">{item.title}</span>
                  {showSubtitle && <span className="lesson-context">{item.context}</span>}
                  {(tabs > 0 || backingTracks > 0) && (
                    <span className="lesson-tags">
                      {tabs > 0 && (
                        <span className="tag tag-tab" title={`${tabs} tablature${tabs > 1 ? 's' : ''}`}>
                          Tablature{tabs > 1 ? `s ${tabs}` : ''}
                        </span>
                      )}
                      {backingTracks > 0 && (
                        <span
                          className="tag tag-audio"
                          title={`${backingTracks} backing track${backingTracks > 1 ? 's' : ''}`}
                        >
                          Backing {backingTracks}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="star"
                aria-pressed={favorites.has(item.id)}
                aria-label={`${item.title} : ${favorites.has(item.id) ? 'retirer des favoris' : 'ajouter aux favoris'}`}
                title={favorites.has(item.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                onClick={() => onToggleFavorite(item)}
              >
                {favorites.has(item.id) ? '★' : '☆'}
              </button>
            </li>
          )
        }

        const open = expanded.has(item.path)
        const { done, total } = countLessons(item.items, progress)
        const { kicker, title } = splitName(item.name)
        return (
          <li key={item.path}>
            <button
              type="button"
              className="group"
              aria-expanded={open}
              onClick={() => onToggleGroup(item.path)}
            >
              <span className="chevron" aria-hidden="true" />
              <span className="group-text">
                {kicker && <span className="group-kicker">{kicker}</span>}
                <span className="group-title">{title}</span>
              </span>
              <span className="group-count" title={`${done} leçon(s) terminée(s) sur ${total}`}>
                {done}/{total}
              </span>
            </button>
            {open && (
              <div className="group-body">
                <Outline {...props} items={item.items} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
