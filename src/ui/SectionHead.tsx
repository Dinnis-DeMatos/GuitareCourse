/** Titre d'une section du pupitre, prolongé par un filet. */
export function SectionHead({ id, title, count }: { id: string; title: string; count?: number }) {
  return (
    <header className="section-head">
      <h3 id={id}>
        {title}
        {count !== undefined && count > 0 && <span>{count}</span>}
      </h3>
      <span className="rule" aria-hidden="true" />
    </header>
  )
}
