import type { CourseFile } from '../courseTypes.ts'
import { Icon } from './Icon.tsx'
import { SectionHead } from './SectionHead.tsx'

/** Le fichier Guitar Pro à jouer : le .gp (Guitar Pro 7 et suivants) d'abord, sinon le .gpx. */
function playable(files: CourseFile[]): CourseFile | undefined {
  return files.find((file) => file.ext === 'gp') ?? files.find((file) => file.ext === 'gpx')
}

/** Regroupe les fichiers de même titre : une tablature existe souvent en PDF, .gp et .gpx. */
function groupByTitle(files: CourseFile[]): { title: string; files: CourseFile[] }[] {
  const groups = new Map<string, CourseFile[]>()
  for (const file of files) groups.set(file.title, [...(groups.get(file.title) ?? []), file])
  return [...groups].map(([title, group]) => ({ title, files: group }))
}

/**
 * Les tablatures d'une leçon : la partition Guitar Pro et le PDF s'affichent à la place de la vidéo.
 */
export function Tablatures({ files, onOpen }: { files: CourseFile[]; onOpen: (file: CourseFile) => void }) {
  const tabs = groupByTitle(files)
  return (
    <section className="tabs" aria-labelledby="tabs-title">
      <SectionHead id="tabs-title" title="Tablatures" count={tabs.length} />
      <ul className="tab-list">
        {tabs.map((tab) => {
          const score = playable(tab.files)
          return (
            <li key={tab.title}>
              <span className="tab-icon" aria-hidden="true">
                <span>T</span>
                <span>A</span>
                <span>B</span>
              </span>
              <div>
                <p className="tab-title">{tab.title}</p>
                <p className="links">
                  {score && (
                    <button type="button" className="link" onClick={() => onOpen(score)}>
                      Jouer la partition
                      <Icon name="play" />
                    </button>
                  )}
                  {tab.files
                    .filter((file) => file.ext === 'pdf')
                    .map((file) => (
                      <button key={file.path} type="button" className="link" onClick={() => onOpen(file)}>
                        Ouvrir le PDF
                        <Icon name="external" />
                      </button>
                    ))}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
