// Raccourcis clavier. Les touches sont identifiées par le caractère produit (« event.key »), pas par
// leur position : elles marchent donc aussi sur un clavier AZERTY.

export type ShortcutAction =
  | 'playPause'
  | 'back'
  | 'forward'
  | 'mute'
  | 'fullscreen'
  | 'loopStart'
  | 'loopEnd'
  | 'loopToggle'
  | 'bookmark'
  | 'slower'
  | 'faster'
  | 'next'
  | 'previous'
  | 'help'

/** Durée d'un saut avec les flèches, en secondes. */
export const SEEK_SECONDS = 5

const ACTION_BY_KEY = new Map<string, ShortcutAction>([
  [' ', 'playPause'],
  ['k', 'playPause'],
  ['arrowleft', 'back'],
  ['arrowright', 'forward'],
  ['m', 'mute'],
  ['f', 'fullscreen'],
  ['a', 'loopStart'],
  ['b', 'loopEnd'],
  ['l', 'loopToggle'],
  ['r', 'bookmark'],
  ['<', 'slower'],
  ['-', 'slower'],
  ['>', 'faster'],
  ['+', 'faster'],
  ['=', 'faster'],
  ['n', 'next'],
  ['p', 'previous'],
  ['?', 'help'],
  ['h', 'help'],
])

/** Action liée à une frappe ; null si aucune, ou si Ctrl, Alt ou Cmd sont enfoncés (raccourcis du navigateur). */
export function resolveShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>,
): ShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  return ACTION_BY_KEY.get(event.key.toLowerCase()) ?? null
}

/** Vrai si la frappe est destinée à un champ de saisie : on n'y touche jamais. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Texte de l'aide : les touches, puis ce qu'elles font. */
export const SHORTCUT_HELP: { keys: string[]; label: string }[] = [
  { keys: ['Espace', 'K'], label: 'Lecture / pause' },
  { keys: ['←', '→'], label: `Reculer / avancer de ${SEEK_SECONDS} secondes` },
  { keys: ['<', '>'], label: 'Vitesse plus lente / plus rapide' },
  { keys: ['A', 'B'], label: 'Début / fin de la boucle' },
  { keys: ['L'], label: 'Activer / arrêter la boucle' },
  { keys: ['R'], label: 'Ajouter un repère à cet instant' },
  { keys: ['N', 'P'], label: 'Leçon suivante / précédente' },
  { keys: ['M'], label: 'Couper / remettre le son' },
  { keys: ['F'], label: 'Plein écran' },
  { keys: ['?'], label: 'Afficher cette aide' },
]
