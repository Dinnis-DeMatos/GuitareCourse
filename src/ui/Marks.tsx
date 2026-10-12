import type { Bookmark } from '../courseTypes.ts'
import { formatTime } from '../progress.ts'
import { Icon } from './Icon.tsx'
import { SectionHead } from './SectionHead.tsx'

/**
 * Les repères d'une leçon, numérotés dans un cadre comme les repères d'une partition. Un repère est
 * un instant ; avec une fin, c'est un passage qui repart en boucle quand on le lance.
 */
export function Marks({
  marks,
  onGo,
  onRename,
  onDelete,
}: {
  /** Triés par instant : leur rang (à partir de 1) est leur numéro, le même que sur la portée. */
  marks: Bookmark[]
  onGo: (mark: Bookmark) => void
  onRename: (mark: Bookmark, label: string) => void
  onDelete: (mark: Bookmark) => void
}) {
  return (
    <section className="marks" aria-labelledby="marks-title">
      <SectionHead id="marks-title" title="Repères" count={marks.length} />
      {marks.length > 0 && (
        <ol className="mark-list">
          {marks.map((mark, index) => {
            const passage = mark.end !== undefined
            return (
              <li key={mark.id}>
                <button
                  type="button"
                  className="mark-go"
                  onClick={() => onGo(mark)}
                  title={passage ? 'Lire ce passage en boucle' : 'Lire à partir de ce repère'}
                  aria-label={
                    passage
                      ? `Repère ${index + 1} : lire en boucle de ${formatTime(mark.time)} à ${formatTime(mark.end ?? 0)}`
                      : `Repère ${index + 1} : lire à partir de ${formatTime(mark.time)}`
                  }
                >
                  <span className="mark-n">{index + 1}</span>
                  <span className="mark-t">
                    {formatTime(mark.time)}
                    {mark.end !== undefined && (
                      <>
                        <Icon name="repeatEnd" className="sign" />
                        {formatTime(mark.end)}
                      </>
                    )}
                  </span>
                </button>
                <input
                  type="text"
                  className="mark-name"
                  aria-label={`Nom du repère ${index + 1}`}
                  placeholder="Nom du repère"
                  maxLength={200}
                  value={mark.label}
                  onChange={(event) => onRename(mark, event.target.value)}
                />
                <button
                  type="button"
                  className="mark-del"
                  aria-label={`Supprimer le repère ${index + 1}`}
                  title="Supprimer"
                  onClick={() => onDelete(mark)}
                >
                  <Icon name="close" />
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <p className="hint">
        {marks.length === 0 && 'Aucun repère pour cette leçon. '}
        Touche <kbd>R</kbd> pour en poser un pendant la lecture. « Garder » conserve la boucle en cours.
      </p>
    </section>
  )
}
