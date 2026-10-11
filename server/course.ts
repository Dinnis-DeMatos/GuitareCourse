import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { CourseFile, CourseFolder, MediaKind } from '../src/courseTypes.ts'

const KIND_BY_EXT: Record<string, MediaKind> = {
  mp4: 'video',
  wav: 'audio',
  pdf: 'tab',
  gp: 'tab',
  gpx: 'tab',
}

/** Dossiers ignorés (insensible à la casse) : les archives zip du cours. */
const IGNORED_FOLDERS = new Set(['zip'])

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

// Les zips du cours viennent d'un Mac : l'accent y est un caractère combinant (U+03xx, octets
// CC xx en UTF-8). L'extraction les a lus en DOS (cp437) : 0xCC est devenu « ╠ » (U+2560) et
// l'octet suivant une lettre cp437 (« ü » pour 0x81, « é » pour 0x82…).
const CP437_BOX = String.fromCharCode(0x2560)
const COMBINING_BY_CP437_CHAR: Record<string, number> = {
  Ç: 0x0300, // accent grave
  ü: 0x0301, // accent aigu
  é: 0x0302, // circonflexe
  â: 0x0303, // tilde
  ä: 0x0304, // macron
  ê: 0x0308, // tréma
  º: 0x0327, // cédille
  '¿': 0x0328, // ogonek
}
const MOJIBAKE_ACCENT = new RegExp(`${CP437_BOX}([${Object.keys(COMBINING_BY_CP437_CHAR).join('')}])`, 'g')

/**
 * Nom à afficher : répare les accents mal extraits (voir ci-dessus) puis recompose les lettres
 * accentuées. Le nom réel reste dans `path`, seul à servir pour retrouver le fichier.
 */
function display(name: string): string {
  return name
    .replace(MOJIBAKE_ACCENT, (_, char: string) => String.fromCharCode(COMBINING_BY_CP437_CHAR[char]))
    .normalize('NFC')
}

async function scanFolder(absDir: string, relDir: string): Promise<CourseFolder> {
  const entries = await readdir(absDir, { withFileTypes: true })
  const folders: CourseFolder[] = []
  const files: CourseFile[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const abs = path.join(absDir, entry.name)
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      if (IGNORED_FOLDERS.has(entry.name.toLowerCase())) continue
      const sub = await scanFolder(abs, rel)
      if (sub.folders.length > 0 || sub.files.length > 0) folders.push(sub)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).slice(1).toLowerCase()
      const kind = KIND_BY_EXT[ext]
      if (!kind) continue
      files.push({
        title: display(path.basename(entry.name, path.extname(entry.name))),
        ext,
        kind,
        path: rel,
        size: (await stat(abs)).size,
      })
    }
  }

  folders.sort((a, b) => collator.compare(a.name, b.name))
  files.sort((a, b) => collator.compare(a.title, b.title))
  return { name: display(path.basename(absDir)), path: relDir, folders, files }
}

export function scanCourse(root: string): Promise<CourseFolder> {
  return scanFolder(root, '')
}
