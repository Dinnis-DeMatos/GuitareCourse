import { useEffect, useRef, useState } from 'react'
import { previousVersion } from '../desktop.ts'
import { APP_VERSION, releasesSince, type Release } from '../version.ts'

const REPOSITORY = 'https://github.com/Dinnis-DeMatos/GuitareCourse'

/** Les logiciels libres livrés avec l'application, et leur licence (dont le texte est en lien). */
const CREDITS: { name: string; use: string; license: string; url: string }[] = [
  { name: 'Electron', use: "L'application de bureau", license: 'MIT', url: 'https://github.com/electron/electron/blob/main/LICENSE' },
  { name: 'React', use: "L'interface", license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
  { name: 'alphaTab', use: 'Les partitions Guitar Pro', license: 'MPL 2.0', url: 'https://github.com/CoderLine/alphaTab/blob/develop/LICENSE' },
  { name: 'PDF.js', use: 'Les tablatures PDF', license: 'Apache 2.0', url: 'https://github.com/mozilla/pdf.js/blob/master/LICENSE' },
  { name: 'Bravura', use: 'La police des partitions', license: 'SIL OFL 1.1', url: 'https://github.com/steinbergmedia/bravura/blob/master/LICENSE.txt' },
  { name: 'Sonivox EAS', use: 'Les sons des partitions', license: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  { name: 'electron-updater', use: 'Les mises à jour', license: 'MIT', url: 'https://github.com/electron-userland/electron-builder/blob/master/LICENSE' },
]

/** Ouvre la fenêtre quand `open` passe à vrai, la ferme quand il repasse à faux. */
function useModal(open: boolean) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      // Le focus va au bouton plutôt qu'au premier lien, qui serait encadré sans qu'on l'ait choisi.
      element.querySelector<HTMLElement>('.sheet-close')?.focus()
      element.scrollTop = 0
    }
    if (!open && element.open) element.close()
  }, [open])
  return dialog
}

function ReleaseNotes({ releases }: { releases: Release[] }) {
  return releases.map((release) => (
    <section key={release.version} className="sheet-part">
      <h3>Version {release.version}</h3>
      <ul className="release-items">
        {release.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  ))
}

/** Options → À propos : la version, l'auteur, les logiciels libres utilisés. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useModal(open)
  return (
    <dialog ref={dialog} className="sheet" aria-labelledby="about-title" onClose={onClose}>
      <div className="sheet-body">
        <p className="sheet-kicker">À propos</p>
        <h2 id="about-title">GuitareCourse</h2>
        <p className="about-lead">
          Version {APP_VERSION} · © 2026 Dinnis-DeMatos ·{' '}
          <a href={REPOSITORY} target="_blank" rel="noreferrer">
            Code source
          </a>
        </p>
        <ReleaseNotes releases={releasesSince('')} />
        <h3 className="sheet-part-title">Logiciels libres</h3>
        <dl className="about-credits">
          {CREDITS.map((credit) => (
            <div key={credit.name}>
              <dt>{credit.name}</dt>
              <dd>
                {credit.use} ·{' '}
                <a href={credit.url} target="_blank" rel="noreferrer">
                  {credit.license}
                </a>
              </dd>
            </div>
          ))}
        </dl>
        <button type="button" className="sheet-close" onClick={onClose}>
          Fermer
        </button>
      </div>
    </dialog>
  )
}

/** Après une mise à jour, une fois : les nouveautés des versions installées depuis le dernier lancement. */
export function WhatsNew() {
  const [releases, setReleases] = useState<Release[]>([])
  useEffect(() => {
    void previousVersion().then((previous) => {
      if (previous !== null) setReleases(releasesSince(previous))
    })
  }, [])
  const dialog = useModal(releases.length > 0)
  const close = () => setReleases([])
  return (
    <dialog ref={dialog} className="sheet" aria-labelledby="whats-new-title" onClose={close}>
      <div className="sheet-body">
        <p className="sheet-kicker">Mise à jour</p>
        <h2 id="whats-new-title">Quoi de neuf</h2>
        <ReleaseNotes releases={releases} />
        <button type="button" className="sheet-close" onClick={close}>
          Continuer
        </button>
      </div>
    </dialog>
  )
}
