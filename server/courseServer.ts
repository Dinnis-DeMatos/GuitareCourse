import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import type { CourseFolder } from '../src/courseTypes.ts'
import { scanCourse } from './course.ts'
import { parseAnnotations, readAnnotations, saveAnnotations } from './annotations.ts'
import { backupDataFiles, listBackups, restoreBackup } from './backups.ts'
import { parseProgressionUpdate, readProgressions, saveProgression } from './chords.ts'
import { recoveries } from './jsonStore.ts'
import { readFavorites, setFavorite } from './favorites.ts'
import { migrateLegacyPaths } from './migrate.ts'
import { readProgress, saveProgress } from './progress.ts'
import { relinkMoved } from './relink.ts'
import { parseSessionResult, readTrainer, saveSession } from './trainer.ts'

/** Dossier qui contient les méthodes : chacun de ses sous-dossiers est une méthode. */
export const DEFAULT_COURSES_DIR = 'S:\\Cours guitare'

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

/** Lit l'en-tête Range (« bytes=début-fin » ou « bytes=-n ») ; null si invalide. */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (match[1] === '' && match[2] === '')) return null
  let start: number
  let end: number
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]))
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }
  return start <= end && start < size ? { start, end } : null
}

async function sendMedia(req: IncomingMessage, res: ServerResponse, root: string, urlPath: string) {
  let relative: string
  try {
    relative = decodeURIComponent(urlPath.slice('/media/'.length))
  } catch {
    return sendJson(res, 400, { error: 'Chemin invalide.' })
  }

  // Empêche de sortir du dossier du cours (« .. », chemins absolus).
  const absolute = path.resolve(root, relative)
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    return sendJson(res, 403, { error: 'Accès refusé.' })
  }

  let size: number
  try {
    const info = await stat(absolute)
    if (!info.isFile()) return sendJson(res, 404, { error: 'Fichier introuvable.' })
    size = info.size
  } catch {
    return sendJson(res, 404, { error: 'Fichier introuvable.' })
  }

  res.setHeader('Content-Type', CONTENT_TYPES[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('Accept-Ranges', 'bytes')

  let start = 0
  let end = size - 1
  const rangeHeader = req.headers.range
  if (rangeHeader) {
    const range = parseRange(rangeHeader, size)
    if (!range) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${size}`)
      return res.end()
    }
    ;({ start, end } = range)
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  }
  res.setHeader('Content-Length', end - start + 1)

  if (req.method === 'HEAD' || size === 0) return res.end()
  const stream = createReadStream(absolute, { start, end })
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

const MAX_BODY_BYTES = 16 * 1024

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('Requête trop volumineuse.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Valide le corps d'un PUT /api/progress ; renvoie null s'il est incorrect. */
function parseProgressUpdate(body: unknown) {
  if (typeof body !== 'object' || body === null) return null
  const { path: videoPath, position, duration, completed } = body as Record<string, unknown>
  const isSeconds = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
  if (typeof videoPath !== 'string' || videoPath === '' || videoPath.length > 1024) return null
  if (!isSeconds(position) || !isSeconds(duration) || typeof completed !== 'boolean') return null
  return { videoPath, update: { position, duration, completed } }
}

/** Valide le corps d'un PUT /api/favorites ; renvoie null s'il est incorrect. */
function parseFavoriteUpdate(body: unknown) {
  if (typeof body !== 'object' || body === null) return null
  const { path: videoPath, favorite } = body as Record<string, unknown>
  if (typeof videoPath !== 'string' || videoPath === '' || videoPath.length > 1024) return null
  if (typeof favorite !== 'boolean') return null
  return { videoPath, favorite }
}

/**
 * Met le dossier du cours à disposition de l'application (le même code sert Vite et l'exécutable) :
 *   GET /api/course        → arborescence du dossier des méthodes (JSON) : chaque sous-dossier est une méthode
 *   GET /media/<chemin>    → fichier d'une méthode, avec lecture partielle (Range) pour les vidéos
 *   GET /api/progress      → progression de toutes les vidéos
 *   PUT /api/progress      → enregistre la progression d'une vidéo { path, position, duration, completed }
 *   GET /api/favorites     → chemins des vidéos des leçons favorites
 *   PUT /api/favorites     → ajoute ou retire un favori { path, favorite }
 *   GET /api/annotations   → notes et repères de toutes les leçons
 *   PUT /api/annotations   → remplace ceux d'une leçon { path, notes, bookmarks }
 *   GET /api/trainer       → exercice du manche : bilan de chaque note et historique des séances
 *   PUT /api/trainer       → ajoute une séance { mode, right, tries, notes }
 *   GET /api/chords        → carnet d'accords : les suites enregistrées
 *   PUT /api/chords        → ajoute, remplace ou supprime une suite { id, progression | null }
 *   GET /api/backups       → sauvegardes des données (une par jour, plus l'état d'avant la dernière restauration)
 *   POST /api/backups      → remet une sauvegarde { name }
 *   GET /api/recoveries    → fichiers abîmés remplacés par leur sauvegarde depuis le démarrage
 */
export function courseHandler(
  coursesDir = process.env.COURSES_DIR ?? DEFAULT_COURSES_DIR,
  progressFile = process.env.PROGRESS_FILE ?? path.resolve('data', 'progress.json'),
  favoritesFile = process.env.FAVORITES_FILE ?? path.resolve('data', 'favorites.json'),
  annotationsFile = process.env.ANNOTATIONS_FILE ?? path.resolve('data', 'annotations.json'),
  trainerFile = process.env.TRAINER_FILE ?? path.resolve('data', 'trainer.json'),
  chordsFile = process.env.CHORDS_FILE ?? path.resolve('data', 'chords.json'),
  sizesFile = process.env.SIZES_FILE ?? path.resolve('data', 'sizes.json'),
) {
  const root = path.resolve(coursesDir)
  const dataFiles = [progressFile, favoritesFile, annotationsFile, trainerFile, chordsFile]
  // La sauvegarde du jour : au premier accès aux données (pas au build), et un échec n'empêche pas de s'en servir.
  let backedUp: Promise<void> | null = null
  const ensureBackedUp = () =>
    (backedUp ??= backupDataFiles(dataFiles).catch((error) => {
      console.error('[guitarecourse] sauvegarde des données impossible :', error)
    }))

  // Mise à niveau des anciens chemins : faite une fois, au premier accès aux données (jamais au build).
  let migrated: Promise<void> | null = null
  const ensureMigrated = () =>
    (migrated ??= migrateLegacyPaths(root, progressFile, favoritesFile).catch((error) => {
      console.error('[guitarecourse] migration des chemins impossible :', error)
    }))

  // Données rattachées aux vidéos renommées ou déplacées : à chaque lecture du dossier, et avant la
  // première lecture des données (qui peut arriver avant celle du dossier).
  // Un rattachement à la fois : sous Windows, relire un fichier pendant qu'un autre le remplace échoue (EPERM).
  let relinkQueue: Promise<unknown> = Promise.resolve()
  const relink = (course: CourseFolder) =>
    (relinkQueue = relinkQueue.then(() =>
      relinkMoved(course, sizesFile, progressFile, favoritesFile, annotationsFile).catch((error) => {
        console.error('[guitarecourse] rattachement des vidéos déplacées impossible :', error)
      }),
    ))
  let relinked: Promise<unknown> | null = null
  const ensureRelinked = () =>
    (relinked ??= ensureMigrated().then(() => scanCourse(root).then(relink, () => undefined)))

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname

    try {
      if (urlPath.startsWith('/api/') && urlPath !== '/api/course') await ensureBackedUp()
      if (urlPath === '/api/progress' || urlPath === '/api/favorites') await ensureMigrated()
      if (urlPath === '/api/progress' || urlPath === '/api/favorites' || urlPath === '/api/annotations') {
        await ensureRelinked()
      }

      if (urlPath === '/api/progress') {
        if (req.method === 'GET') return sendJson(res, 200, await readProgress(progressFile))
        if (req.method === 'PUT') {
          let parsed: ReturnType<typeof parseProgressUpdate>
          try {
            parsed = parseProgressUpdate(await readJsonBody(req))
          } catch {
            parsed = null
          }
          if (!parsed) return sendJson(res, 400, { error: 'Progression invalide.' })
          return sendJson(res, 200, await saveProgress(progressFile, parsed.videoPath, parsed.update))
        }
        return sendJson(res, 405, { error: 'Méthode non autorisée.' })
      }

      if (urlPath === '/api/favorites') {
        if (req.method === 'GET') return sendJson(res, 200, await readFavorites(favoritesFile))
        if (req.method === 'PUT') {
          let parsed: ReturnType<typeof parseFavoriteUpdate>
          try {
            parsed = parseFavoriteUpdate(await readJsonBody(req))
          } catch {
            parsed = null
          }
          if (!parsed) return sendJson(res, 400, { error: 'Favori invalide.' })
          return sendJson(res, 200, await setFavorite(favoritesFile, parsed.videoPath, parsed.favorite))
        }
        return sendJson(res, 405, { error: 'Méthode non autorisée.' })
      }

      if (urlPath === '/api/annotations') {
        if (req.method === 'GET') return sendJson(res, 200, await readAnnotations(annotationsFile))
        if (req.method === 'PUT') {
          let videoPath: unknown
          let annotations: ReturnType<typeof parseAnnotations> = null
          try {
            const body = (await readJsonBody(req)) as Record<string, unknown> | null
            videoPath = body?.path
            annotations = parseAnnotations(body)
          } catch {
            annotations = null
          }
          if (typeof videoPath !== 'string' || videoPath === '' || videoPath.length > 1024 || !annotations) {
            return sendJson(res, 400, { error: 'Annotations invalides.' })
          }
          await saveAnnotations(annotationsFile, videoPath, annotations)
          return sendJson(res, 200, annotations)
        }
        return sendJson(res, 405, { error: 'Méthode non autorisée.' })
      }

      if (urlPath === '/api/trainer') {
        if (req.method === 'GET') return sendJson(res, 200, await readTrainer(trainerFile))
        if (req.method === 'PUT') {
          let parsed: ReturnType<typeof parseSessionResult>
          try {
            parsed = parseSessionResult(await readJsonBody(req))
          } catch {
            parsed = null
          }
          if (!parsed) return sendJson(res, 400, { error: 'Séance invalide.' })
          return sendJson(res, 200, await saveSession(trainerFile, parsed))
        }
        return sendJson(res, 405, { error: 'Méthode non autorisée.' })
      }

      if (urlPath === '/api/backups') {
        if (req.method === 'GET') return sendJson(res, 200, await listBackups(dataFiles))
        if (req.method === 'POST') {
          let name: unknown
          try {
            name = ((await readJsonBody(req)) as Record<string, unknown> | null)?.name
          } catch {
            name = null
          }
          if (typeof name !== 'string' || !(await restoreBackup(dataFiles, name))) {
            return sendJson(res, 400, { error: 'Sauvegarde introuvable.' })
          }
          // Les données viennent d'être remplacées : l'avertissement d'une récupération n'a plus lieu d'être.
          recoveries.length = 0
          return sendJson(res, 200, { restored: name })
        }
        return sendJson(res, 405, { error: 'Méthode non autorisée.' })
      }

      if (urlPath === '/api/recoveries') return sendJson(res, 200, recoveries)

      if (urlPath === '/api/chords') {
        if (req.method === 'GET') return sendJson(res, 200, await readProgressions(chordsFile))
        if (req.method === 'PUT') {
          let parsed: ReturnType<typeof parseProgressionUpdate>
          try {
            parsed = parseProgressionUpdate(await readJsonBody(req))
          } catch {
            parsed = null
          }
          if (!parsed) return sendJson(res, 400, { error: "Suite d'accords invalide." })
          return sendJson(res, 200, await saveProgression(chordsFile, parsed.id, parsed.progression))
        }
        return sendJson(res, 405, { error: 'Méthode non autorisée.' })
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return next()

      if (urlPath === '/api/course') {
        try {
          const course = await scanCourse(root)
          await ensureBackedUp()
          await ensureMigrated()
          await (relinked = relink(course))
          return sendJson(res, 200, course)
        } catch {
          return sendJson(res, 404, { error: `Dossier du cours introuvable : ${root}` })
        }
      }
      if (urlPath.startsWith('/media/')) return await sendMedia(req, res, root, urlPath)
    } catch (error) {
      if (!res.headersSent) return sendJson(res, 500, { error: String(error) })
      return res.destroy()
    }
    next()
  }

  return handler
}

/** Le même service, branché sur le serveur de développement (et d'aperçu) de Vite. */
export function courseServer(...options: Parameters<typeof courseHandler>): Plugin {
  const handler = courseHandler(...options)
  return {
    name: 'guitarecourse-course-server',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
