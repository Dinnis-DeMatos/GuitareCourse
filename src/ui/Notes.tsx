import { MAX_NOTES_LENGTH } from '../limits.ts'
import { SectionHead } from './SectionHead.tsx'

/** Notes personnelles d'une leçon : enregistrées automatiquement pendant la saisie. */
export function Notes({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
}) {
  return (
    <section className="notes" aria-labelledby="notes-title">
      <SectionHead id="notes-title" title="Mes notes" />
      <div className="notepad">
        <textarea
          value={value}
          maxLength={MAX_NOTES_LENGTH}
          aria-labelledby="notes-title"
          placeholder="Ce qu'il reste à travailler, le tempo atteint, un doigté à retenir…"
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      </div>
      <p className="hint">Enregistrées automatiquement.</p>
    </section>
  )
}
