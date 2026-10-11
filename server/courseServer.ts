import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { scanCourse } from './course.ts'

export const DEFAULT_COURSE_DIR = 'S:\\Cours guitare\\Méthode polyvalante'

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

/**
 * Met le dossier du cours à disposition de l'application :
 *   GET /api/course        → arborescence du cours (JSON)
 *   GET /media/<chemin>    → fichier du cours, avec lecture partielle (Range) pour les vidéos
 */
export function courseServer(courseDir = process.env.COURSE_DIR ?? DEFAULT_COURSE_DIR): Plugin {
  const root = path.resolve(courseDir)

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname

    try {
      if (urlPath === '/api/course') {
        try {
          return sendJson(res, 200, await scanCourse(root))
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
