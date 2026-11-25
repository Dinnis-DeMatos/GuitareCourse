import { useEffect, useRef, useState } from 'react'
import type { Theme } from '../App.tsx'
import { changeTabsDir, chooseCoursesDir, setDesktopFinish } from '../desktop.ts'
import { usePersistentState } from '../usePersistentState.ts'
import { AboutDialog } from './About.tsx'
import { BackupsDialog } from './Backups.tsx'
import { Icon } from './Icon.tsx'
import { replacePanels } from './panels.ts'
import { dominantHue } from '../wallpaperHue.ts'

/** Les couleurs proposées : des finitions de guitares. La première, celle du logo, est la couleur par défaut. */
const ACCENTS = [
  { id: 'fiesta', name: 'Fiesta Red' },
  { id: 'surf', name: 'Surf Green' },
  { id: 'butterscotch', name: 'Butterscotch' },
  { id: 'daphne', name: 'Daphne Blue' },
  { id: 'shell', name: 'Shell Pink' },
  { id: 'turquoise', name: 'Ocean Turquoise' },
] as const
/** Une finition du nuancier, ou « wallpaper » : la teinte du fond d'écran (tokens.css). */
type Accent = (typeof ACCENTS)[number]['id'] | 'wallpaper'
const isAccent = (value: unknown): value is Accent => value === 'wallpaper' || ACCENTS.some((accent) => accent.id === value)
const isHue = (value: unknown): value is number | null => value === null || (typeof value === 'number' && value >= 0 && value < 360)
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isString = (value: unknown): value is string => typeof value === 'string'

/** Largeur gardée du fond d'écran : assez pour un grand écran, assez léger pour le stockage local (~5 Mo). */
const WALLPAPER_WIDTH = 2560

/** L'image choisie, réduite et recompressée en JPEG, sous forme d'adresse data: à mémoriser. */
async function wallpaperFrom(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, WALLPAPER_WIDTH / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Flou du verre dépoli à l'écran (base.css), en pixels. */
const FROST_BLUR = 18

/**
 * Le fond d'écran déjà flouté, une fois pour toutes : posé sous les cartes, il remplace backdrop-filter,
 * que la carte graphique recalculait à chaque image dès que quelque chose bougeait (la mascotte, la vidéo).
 */
async function frostFrom(wallpaper: string): Promise<string> {
  const image = new Image()
  image.src = wallpaper
  await image.decode()
  // Le flou se mesure à l'écran : on le ramène à l'échelle de l'image étirée sur la fenêtre (cover).
  const radius = FROST_BLUR / Math.max(innerWidth / image.width, innerHeight / image.height)
  // Une image floue n'a pas besoin de détails : réduite, elle se calcule et s'affiche vite.
  const scale = Math.min(1, 8 / radius)
  const blur = radius * scale
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.filter = `blur(${blur}px) saturate(1.2)`
  // Débordant de deux rayons : sans quoi le flou assombrirait les bords.
  context.drawImage(image, -2 * blur, -2 * blur, canvas.width + 4 * blur, canvas.height + 4 * blur)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('canvas')
  return URL.createObjectURL(blob)
}

/** La teinte dominante du fond d'écran, lue sur une vignette : assez de pixels pour la couleur d'ensemble. */
async function hueFrom(wallpaper: string): Promise<number | null> {
  const image = new Image()
  image.src = wallpaper
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = Math.max(1, Math.round((64 * image.height) / image.width))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return dominantHue(context.getImageData(0, 0, canvas.width, canvas.height).data)
}

/** La couleur de l'application (--finish) en #rrggbb : la fenêtre de mise à jour ne lit pas le CSS. */
function finishHex(): string | null {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--finish')
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Le bouton Profil, en bas de la barre de navigation, et son menu : le parcours, puis les options ; il
 * porte aussi les fenêtres des sauvegardes et « À propos ».
 */
export function Options({
  theme,
  onToggleTheme,
  onHelp,
  onRefreshCourses,
  onJournal,
}: {
  theme: Theme
  onToggleTheme: () => void
  onHelp: () => void
  /** Relit le dossier des cours. */
  onRefreshCourses: () => Promise<void>
  /** Ouvre le parcours. */
  onJournal: () => void
}) {
  const themeLabel = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'
  const closeOptions = () => document.getElementById('options-menu')?.hidePopover()
  const [backupsOpen, setBackupsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Clé lue aussi par index.html, qui pose la couleur avant le premier affichage.
  const [accent, setAccent] = usePersistentState<Accent>('guitarecourse.accent', 'fiesta', isAccent)
  // La teinte du fond d'écran, gardée pour index.html qui la pose avant le premier affichage.
  const [wallpaperHue, setWallpaperHue] = usePersistentState<number | null>('guitarecourse.wallpaperHue', null, isHue)
  useEffect(() => {
    const root = document.documentElement
    if (wallpaperHue === null) root.style.removeProperty('--wallpaper-hue')
    else root.style.setProperty('--wallpaper-hue', String(wallpaperHue))
    if (accent === 'fiesta' || (accent === 'wallpaper' && wallpaperHue === null)) delete root.dataset.accent
    else root.dataset.accent = accent
    // À l'image suivante : le thème est posé par App, dont l'effet passe après celui-ci.
    const frame = requestAnimationFrame(() => {
      const finish = finishHex()
      if (finish) setDesktopFinish(finish)
    })
    return () => cancelAnimationFrame(frame)
  }, [accent, theme, wallpaperHue])
  // Le thème des fêtes s'ajoute au thème clair ou sombre ; index.html le pose aussi avant le premier affichage.
  const [festive, setFestive] = usePersistentState('guitarecourse.festive', false, isBoolean)
  useEffect(() => {
    if (festive) document.documentElement.dataset.season = 'fetes'
    else delete document.documentElement.dataset.season
  }, [festive])
  // Le fond d'écran de l'accueil : une image derrière ses cartes, devenues translucides.
  const wallpaperInput = useRef<HTMLInputElement>(null)
  const [wallpaper, setWallpaper] = usePersistentState('guitarecourse.wallpaper', '', isString)
  useEffect(() => {
    const root = document.documentElement
    if (wallpaper) {
      root.style.setProperty('--wallpaper', `url("${wallpaper}")`)
      root.dataset.wallpaper = ''
    } else {
      root.style.removeProperty('--wallpaper')
      delete root.dataset.wallpaper
    }
    if (!wallpaper) return
    void hueFrom(wallpaper).then(setWallpaperHue, () => undefined)
    // Tant que la version floutée n'est pas prête (ou si elle échoue), backdrop-filter fait le travail.
    let frost = ''
    let cancelled = false
    void frostFrom(wallpaper).then((url) => {
      if (cancelled) return URL.revokeObjectURL(url)
      frost = url
      root.style.setProperty('--wallpaper-frost', `url("${url}")`)
      root.dataset.frost = ''
    }, () => undefined)
    return () => {
      cancelled = true
      root.style.removeProperty('--wallpaper-frost')
      delete root.dataset.frost
      if (frost) URL.revokeObjectURL(frost)
    }
  }, [wallpaper, setWallpaperHue])

  return (
    <>
      <button type="button" className="rail-item rail-profile" popoverTarget="options-menu">
        <Icon name="profile" />
        <span>Profil</span>
      </button>
      {/* Se ferme d'un clic à côté ou avec Échap. */}
      {/* Le parcours, puis les options : le cours et ses données, les tablatures, l'apparence, l'aide. */}
      <div id="options-menu" popover="auto" className="options-menu">
        <div className="options-group" role="group" aria-labelledby="options-me">
          <span id="options-me" className="silk">
            Profil
          </span>
          <button type="button" onClick={() => (closeOptions(), replacePanels(onJournal))}>
            <Icon name="journal" />
            Parcours
          </button>
        </div>
        <div className="options-group" role="group" aria-labelledby="options-course">
          <span id="options-course" className="silk">
            Cours
          </span>
          {chooseCoursesDir && (
            <button type="button" onClick={() => (closeOptions(), chooseCoursesDir?.())}>
              <Icon name="folder" />
              Changer le dossier du cours
            </button>
          )}
          {/* Le menu reste ouvert le temps de la relecture : on voit qu'elle a lieu, puis il se ferme. */}
          <button
            type="button"
            disabled={refreshing}
            aria-busy={refreshing}
            onClick={() => {
              setRefreshing(true)
              void onRefreshCourses().finally(() => {
                setRefreshing(false)
                closeOptions()
              })
            }}
          >
            {refreshing ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" />}
            {refreshing ? 'Actualisation…' : 'Actualiser les cours'}
          </button>
          <button type="button" onClick={() => (closeOptions(), replacePanels(() => setBackupsOpen(true)))}>
            <Icon name="backup" />
            Sauvegardes
          </button>
        </div>
        {changeTabsDir && (
          <div className="options-group" role="group" aria-labelledby="options-tabs">
            <span id="options-tabs" className="silk">
              Tablatures
            </span>
            <button type="button" onClick={() => (closeOptions(), void changeTabsDir?.())}>
              <Icon name="folder" />
              Changer le dossier des tablatures
            </button>
          </div>
        )}
        {/* Le thème et la couleur laissent le menu ouvert : on voit le changement. */}
        <div className="options-group" role="group" aria-labelledby="options-look">
          <span id="options-look" className="silk">
            Apparence
          </span>
          <button type="button" onClick={onToggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            {themeLabel}
          </button>
          <button type="button" aria-pressed={festive} onClick={() => setFestive(!festive)}>
            <Icon name="flake" />
            {festive ? 'Retirer le thème des fêtes' : 'Thème des fêtes'}
          </button>
          <button type="button" onClick={() => wallpaperInput.current?.click()}>
            <Icon name="image" />
            {wallpaper ? "Changer le fond d'écran" : "Fond d'écran de l'accueil"}
          </button>
          <input
            ref={wallpaperInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void wallpaperFrom(file).then(setWallpaper, () => undefined)
            }}
          />
          {wallpaper && (
            <button
              type="button"
              onClick={() => {
                setWallpaper('')
                setWallpaperHue(null)
                if (accent === 'wallpaper') setAccent('fiesta')
              }}
            >
              <Icon name="close" />
              Retirer le fond d'écran
            </button>
          )}
          <span className="swatches" role="group" aria-label="Couleur de l'application">
            {ACCENTS.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                className="swatch"
                style={{ background: `var(--${id})` }}
                aria-pressed={accent === id}
                aria-label={name}
                title={name}
                onClick={() => setAccent(id)}
              />
            ))}
            {wallpaper && wallpaperHue !== null && (
              <button
                type="button"
                className="swatch swatch-wallpaper"
                aria-pressed={accent === 'wallpaper'}
                aria-label="Couleur du fond d'écran"
                title="Couleur du fond d'écran"
                onClick={() => setAccent('wallpaper')}
              >
                <Icon name="image" />
              </button>
            )}
          </span>
        </div>
        <div className="options-group" role="group" aria-labelledby="options-help">
          <span id="options-help" className="silk">
            Aide
          </span>
          <button type="button" onClick={() => (closeOptions(), replacePanels(onHelp))}>
            <span className="tool-key">?</span>
            Guide et raccourcis
          </button>
          <button type="button" onClick={() => (closeOptions(), replacePanels(() => setAboutOpen(true)))}>
            <Icon name="info" />
            À propos
          </button>
        </div>
      </div>
      <BackupsDialog open={backupsOpen} onClose={() => setBackupsOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  )
}
