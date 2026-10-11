import type { CourseFile } from './courseTypes.ts'
import { mediaUrl } from './media.ts'

const FORMAT_LABEL: Record<string, string> = {
  pdf: 'PDF',
  gp: 'Guitar Pro',
  gpx: 'Guitar Pro (gpx)',
}

/** Regroupe les fichiers de même titre : une tablature existe souvent en PDF, .gp et .gpx. */
function groupByTitle(files: CourseFile[]): { title: string; files: CourseFile[] }[] {
  const groups = new Map<string, CourseFile[]>()
  for (const file of files) groups.set(file.title, [...(groups.get(file.title) ?? []), file])
  return [...groups].map(([title, group]) => ({ title, files: group }))
}

export function Resources({ files }: { files: CourseFile[] }) {
  const audio = files.filter((file) => file.kind === 'audio')
  const tabs = groupByTitle(files.filter((file) => file.kind === 'tab'))
  if (audio.length === 0 && tabs.length === 0) return null

  return (
    <div className="resources">
      {tabs.length > 0 && (
        <section aria-labelledby="tabs-title">
          <h3 id="tabs-title">Tablatures</h3>
          <ul className="resource-list">
            {tabs.map((tab) => (
              <li key={tab.title}>
                <span className="resource-name">{tab.title}</span>
                <span className="resource-actions">
                  {tab.files.map((file) => (
                    <a
                      key={file.path}
                      className="chip"
                      href={mediaUrl(file)}
                      {...(file.ext === 'pdf' ? { target: '_blank', rel: 'noreferrer' } : { download: '' })}
                    >
                      {FORMAT_LABEL[file.ext] ?? file.ext}
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {audio.length > 0 && (
        <section aria-labelledby="audio-title">
          <h3 id="audio-title">Backing tracks</h3>
          <ul className="resource-list">
            {audio.map((file) => (
              <li key={file.path}>
                <span className="resource-name">{file.title}</span>
                <audio controls preload="none" src={mediaUrl(file)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
