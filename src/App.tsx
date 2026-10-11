import { useEffect, useState } from 'react'
import type { CourseFile, CourseFolder } from './courseTypes.ts'

/** URL d'un fichier du cours : chaque segment du chemin est encodé séparément. */
function mediaUrl(file: CourseFile): string {
  return '/media/' + file.path.split('/').map(encodeURIComponent).join('/')
}

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} Go`
    : `${Math.max(1, Math.round(bytes / 1024 ** 2))} Mo`
}

function FolderView({
  folder,
  current,
  onPlay,
}: {
  folder: CourseFolder
  current: CourseFile | null
  onPlay: (file: CourseFile) => void
}) {
  return (
    <details open>
      <summary>{folder.name}</summary>
      <div style={{ paddingLeft: '1.25rem' }}>
        {folder.files.map((file) => (
          <p key={file.path} style={{ margin: '0.25rem 0' }}>
            {file.kind === 'video' ? (
              <button type="button" onClick={() => onPlay(file)} disabled={current?.path === file.path}>
                ▶ {file.title}
              </button>
            ) : (
              <a href={mediaUrl(file)} target="_blank" rel="noreferrer">
                {file.kind === 'audio' ? '♪' : '♯'} {file.title}.{file.ext}
              </a>
            )}{' '}
            <small>({formatSize(file.size)})</small>
          </p>
        ))}
        {folder.folders.map((sub) => (
          <FolderView key={sub.path} folder={sub} current={current} onPlay={onPlay} />
        ))}
      </div>
    </details>
  )
}

export default function App() {
  const [course, setCourse] = useState<CourseFolder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<CourseFile | null>(null)

  useEffect(() => {
    fetch('/api/course')
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? `Erreur ${response.status}`)
        setCourse(body as CourseFolder)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <main style={{ maxWidth: '60rem', margin: '0 auto', padding: '1rem' }}>
      <h1>GuitareCourse</h1>
      {error && <p role="alert">{error}</p>}
      {!course && !error && <p>Chargement du cours…</p>}
      {current && (
        <section>
          <h2>{current.title}</h2>
          <video key={current.path} src={mediaUrl(current)} controls autoPlay style={{ width: '100%' }} />
        </section>
      )}
      {course && <FolderView folder={course} current={current} onPlay={setCurrent} />}
    </main>
  )
}
