import type { ReactNode } from 'react'

// Les pictogrammes de l'application, dessinés pour elle : aucun caractère spécial ni émoji, dont le
// rendu change d'un système à l'autre. Tous prennent la couleur du texte (currentColor).

const stroke = { fill: 'none', stroke: 'currentColor' } as const

const ICONS = {
  /** Le médiator qui sert de logo et de bouton de lecture : un triangle « lecture » dans un médiator. */
  pick: {
    box: '0 0 24 24',
    body: (
      <>
        <path
          fill="currentColor"
          d="M12 22.6c-2 0-9.6-10.4-9.6-15C2.4 3.7 6.4 1.6 12 1.6s9.6 2.1 9.6 6c0 4.6-7.6 15-9.6 15Z"
        />
        <path fill="var(--ink)" d="M9.4 6.4 16 10.2l-6.6 3.8Z" />
      </>
    ),
  },
  play: { box: '0 0 20 20', body: <path fill="currentColor" d="M5.5 3.2 17 10 5.5 16.8Z" /> },
  pause: { box: '0 0 20 20', body: <path fill="currentColor" d="M4.5 3.5h4v13h-4zM11.5 3.5h4v13h-4z" /> },
  check: { box: '0 0 10 10', body: <path {...stroke} strokeWidth="2" d="m1.6 5.2 2.3 2.3 4.4-5" /> },
  star: {
    box: '0 0 20 20',
    body: (
      <path
        {...stroke}
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="m10 2.3 2.4 5 5.4.7-4 3.8 1 5.4L10 14.6 5.2 17.2l1-5.4-4-3.8 5.4-.7Z"
      />
    ),
  },
  starFilled: {
    box: '0 0 20 20',
    body: (
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="m10 2.3 2.4 5 5.4.7-4 3.8 1 5.4L10 14.6 5.2 17.2l1-5.4-4-3.8 5.4-.7Z"
      />
    ),
  },
  chevronDown: { box: '0 0 12 12', body: <path {...stroke} strokeWidth="2" d="m2 4 4 4 4-4" /> },
  chevronRight: { box: '0 0 12 12', body: <path {...stroke} strokeWidth="2" d="m4 2 4 4-4 4" /> },
  chevronLeft: { box: '0 0 12 12', body: <path {...stroke} strokeWidth="2" d="M8 2 4 6l4 4" /> },
  /** Signe de reprise ouvrant d'une partition : barre épaisse, barre fine, deux points. */
  repeatStart: {
    box: '0 0 13 32',
    body: (
      <>
        <path fill="currentColor" d="M0 0h3.2v32H0zM5.2 0h1.2v32H5.2z" />
        <circle cx="10" cy="12.6" r="1.7" fill="currentColor" />
        <circle cx="10" cy="19.4" r="1.7" fill="currentColor" />
      </>
    ),
  },
  /** Signe de reprise fermant : deux points, barre fine, barre épaisse. */
  repeatEnd: {
    box: '0 0 13 32',
    body: (
      <>
        <path fill="currentColor" d="M9.8 0H13v32H9.8zM6.6 0h1.2v32H6.6z" />
        <circle cx="3" cy="12.6" r="1.7" fill="currentColor" />
        <circle cx="3" cy="19.4" r="1.7" fill="currentColor" />
      </>
    ),
  },
  close: { box: '0 0 12 12', body: <path {...stroke} strokeWidth="1.8" d="m2 2 8 8m0-8-8 8" /> },
  plus: { box: '0 0 12 12', body: <path {...stroke} strokeWidth="2" d="M6 1v10M1 6h10" /> },
  volume: {
    box: '0 0 20 20',
    body: (
      <>
        <path fill="currentColor" d="M2.5 7.5h3.2L10.5 3.6v12.8L5.7 12.5H2.5Z" />
        <path {...stroke} strokeWidth="1.7" d="M13 7.2a3.9 3.9 0 0 1 0 5.6M15.3 4.8a7.2 7.2 0 0 1 0 10.4" />
      </>
    ),
  },
  mute: {
    box: '0 0 20 20',
    body: (
      <>
        <path fill="currentColor" d="M2.5 7.5h3.2L10.5 3.6v12.8L5.7 12.5H2.5Z" />
        <path {...stroke} strokeWidth="1.8" d="m13.2 7.6 4.8 4.8m0-4.8-4.8 4.8" />
      </>
    ),
  },
  fullscreen: {
    box: '0 0 20 20',
    body: <path {...stroke} strokeWidth="2" d="M3.5 8V3.5H8M12 3.5h4.5V8M16.5 12v4.5H12M8 16.5H3.5V12" />,
  },
  fullscreenExit: {
    box: '0 0 20 20',
    body: <path {...stroke} strokeWidth="2" d="M8 3.5V8H3.5M16.5 8H12V3.5M12 16.5V12h4.5M3.5 12H8v4.5" />,
  },
  external: { box: '0 0 12 12', body: <path {...stroke} strokeWidth="1.6" d="M4.5 2H2v8h8V7.5M7 2h3v3M10 2 5.5 6.5" /> },
  download: { box: '0 0 12 12', body: <path {...stroke} strokeWidth="1.6" d="M6 1v7M3 5.5 6 8.5l3-3M1.5 11h9" /> },
  /** Une noire, pour l'indication de tempo « ♩ = 110 ». */
  note: {
    box: '0 0 12 18',
    body: (
      <>
        <ellipse cx="4.6" cy="14.2" rx="3.9" ry="2.9" transform="rotate(-22 4.6 14.2)" fill="currentColor" />
        <path fill="currentColor" d="M7.3 1h1.4v13H7.3z" />
      </>
    ),
  },
  folder: {
    box: '0 0 20 20',
    body: <path {...stroke} strokeWidth="1.7" strokeLinejoin="round" d="M2.5 5.5h5l1.6 2h8.4v8h-15Z" />,
  },
  menu: { box: '0 0 20 20', body: <path {...stroke} strokeWidth="2" d="M3 5.5h14M3 10h14M3 14.5h9" /> },
} satisfies Record<string, { box: string; body: ReactNode }>

export type IconName = keyof typeof ICONS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const icon = ICONS[name]
  return (
    <svg className={className ? `icon ${className}` : 'icon'} viewBox={icon.box} aria-hidden="true" focusable="false">
      {icon.body}
    </svg>
  )
}
