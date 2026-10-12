import type { CourseFile } from '../courseTypes.ts'
import { mediaUrl } from '../media.ts'
import { Icon } from './Icon.tsx'
import { SectionHead } from './SectionHead.tsx'

const FORMAT_LABEL: Record<string, string> = {
  pdf: 'Ouvrir le PDF',
  gp: 'Guitar Pro',
  gpx: 'GPX',
}

/** Ordre des formats : le PDF d'abord, il s'ouvre sans rien installer. */
const FORMAT_ORDER = ['pdf', 'gp', 'gpx']

function formatRank(file: CourseFile): number {
  const rank = FORMAT_ORDER.indexOf(file.ext)
  return rank === -1 ? FORMAT_ORDER.length : rank
}

/** Regroupe les fichiers de même titre : une tablature existe souvent en PDF, .gp et .gpx. */
function groupByTitle(files: CourseFile[]): { title: string; files: CourseFile[] }[] {
  const groups = new Map<string, CourseFile[]>()
  for (const file of files) groups.set(file.title, [...(groups.get(file.title) ?? []), file])
  return [...groups].map(([title, group]) => ({
    title,
    files: [...group].sort((a, b) => formatRank(a) - formatRank(b)),
  }))
}

/** Les tablatures d'une leçon : le PDF s'ouvre dans un onglet, les fichiers Guitar Pro se téléchargent. */
export function Tablatures({ files }: { files: CourseFile[] }) {
  const tabs = groupByTitle(files)
  return (
    <section className="tabs" aria-labelledby="tabs-title">
      <SectionHead id="tabs-title" title="Tablatures" count={tabs.length} />
      <ul className="tab-list">
        {tabs.map((tab) => (
          <li key={tab.title}>
            <span className="tab-icon" aria-hidden="true">
              <span>T</span>
              <span>A</span>
              <span>B</span>
            </span>
            <div>
              <p className="tab-title">{tab.title}</p>
              <p className="links">
                {tab.files.map((file) => {
                  const opens = file.ext === 'pdf'
                  return (
                    <a
                      key={file.path}
                      className="link"
                      href={mediaUrl(file)}
                      {...(opens ? { target: '_blank', rel: 'noreferrer' } : { download: '' })}
                    >
                      {FORMAT_LABEL[file.ext] ?? file.ext}
                      <Icon name={opens ? 'external' : 'download'} />
                    </a>
                  )
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
