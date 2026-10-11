import { describe, expect, it } from 'vitest'
import { resolveShortcut, SHORTCUT_HELP } from './shortcuts.ts'

const press = (key: string, modifiers: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean }> = {}) =>
  resolveShortcut({ key, ctrlKey: false, altKey: false, metaKey: false, ...modifiers })

describe('resolveShortcut', () => {
  it('associe les touches principales à leur action', () => {
    expect(press(' ')).toBe('playPause')
    expect(press('k')).toBe('playPause')
    expect(press('ArrowLeft')).toBe('back')
    expect(press('ArrowRight')).toBe('forward')
    expect(press('n')).toBe('next')
    expect(press('p')).toBe('previous')
    expect(press('r')).toBe('bookmark')
  })

  it('ne dépend pas de la casse (verrouillage majuscules, Maj)', () => {
    expect(press('K')).toBe('playPause')
    expect(press('A')).toBe('loopStart')
  })

  it('accepte « < » et « > » (clavier AZERTY) comme « - » et « + »', () => {
    expect(press('<')).toBe('slower')
    expect(press('-')).toBe('slower')
    expect(press('>')).toBe('faster')
    expect(press('+')).toBe('faster')
  })

  it('laisse passer les raccourcis du navigateur (Ctrl, Alt, Cmd)', () => {
    expect(press('f', { ctrlKey: true })).toBeNull()
    expect(press('ArrowLeft', { altKey: true })).toBeNull()
    expect(press('r', { metaKey: true })).toBeNull()
  })

  it('ignore les autres touches, y compris les noms qui existent sur les objets JavaScript', () => {
    expect(press('x')).toBeNull()
    expect(press('Enter')).toBeNull()
    expect(press('constructor')).toBeNull()
  })
})

describe('aide', () => {
  it('chaque touche affichée dans l\'aide est bien un raccourci', () => {
    const names: Record<string, string> = { Espace: ' ', '←': 'ArrowLeft', '→': 'ArrowRight' }
    const shown = SHORTCUT_HELP.flatMap((line) => line.keys).map((key) => names[key] ?? key)
    expect(shown.filter((key) => press(key) === null)).toEqual([])
  })
})
