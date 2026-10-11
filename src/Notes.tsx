import { MAX_NOTES_LENGTH } from './limits.ts'

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
      <h3 id="notes-title">Mes notes</h3>
      <textarea
        value={value}
        maxLength={MAX_NOTES_LENGTH}
        rows={4}
        placeholder="Ce qu'il reste à travailler, le tempo atteint, un doigté à retenir…"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      <p className="hint">Enregistrées automatiquement.</p>
    </section>
  )
}
