// La petite fenêtre de mise à jour, dans la charte de l'application : à plat, DIN, filets, une seule
// couleur vive (Fiesta Red, la première finition). La progression s'y lit sur une portée à six cordes,
// comme la barre de lecture : la partie téléchargée prend la couleur.

export type Theme = 'dark' | 'light'

export const SPLASH_SIZE = { width: 460, height: 232 }

/** Fond de la fenêtre avant l'affichage de la page, pour éviter un éclair d'une autre couleur. */
export const BACKGROUND: Record<Theme, string> = { dark: '#101010', light: '#fbfaf7' }

/** Page de la fenêtre ; `window.progress(pourcentage)` la fait avancer. */
export function splashPage(version: string, theme: Theme): string {
  const strings = Array.from({ length: 6 }, (_, i) => `<i style="--i:${i}"></i>`).join('')
  return `<!doctype html>
<html lang="fr" data-theme="${theme}">
<meta charset="utf-8">
<title>Mise à jour de GuitareCourse</title>
<style>
  @font-face { font-family: 'GC DIN'; src: local('Bahnschrift'); font-weight: 300 700; font-stretch: 75% 100%; }
  :root {
    --panel: ${BACKGROUND.dark}; --line: rgb(255 255 255 / 0.1); --string: rgb(255 255 255 / 0.3);
    --text: #f5f5f2; --text-3: #8c8c87; --finish: oklch(0.68 0.21 33); --ink: #0a0a0a;
  }
  [data-theme='light'] {
    --panel: ${BACKGROUND.light}; --line: rgb(0 0 0 / 0.1); --string: rgb(0 0 0 / 0.28);
    --text: #141413; --text-3: #66665f; --finish: oklch(0.56 0.2 33); --ink: #fbfaf7;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; overflow: hidden; }
  body {
    display: grid; grid-template-rows: auto 1fr auto; padding: 22px 24px 20px;
    border: 1px solid var(--line); background: var(--panel); color: var(--text);
    font: 500 14px/1.3 'GC DIN', Bahnschrift, sans-serif; user-select: none; -webkit-app-region: drag;
  }
  header { display: flex; align-items: center; gap: 10px; }
  header svg { width: 18px; height: 18px; color: var(--finish); }
  .word { font-weight: 700; font-stretch: 87.5%; font-size: 15px; letter-spacing: -0.01em; }
  .word span { font-weight: 400; }
  .kicker { margin-left: auto; color: var(--finish); font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
  main { display: flex; align-items: end; justify-content: space-between; gap: 16px; padding-bottom: 14px; }
  h1 { font-weight: 600; font-stretch: 87.5%; font-size: 30px; line-height: 1; letter-spacing: -0.02em; }
  h1 small { display: block; margin-bottom: 6px; color: var(--text-3); font-size: 12px; font-weight: 500; letter-spacing: 0; }
  .percent { font-weight: 700; font-stretch: 80%; font-size: 40px; line-height: 0.8; font-variant-numeric: tabular-nums; }
  .percent span { color: var(--text-3); font-size: 18px; font-weight: 500; }
  .staff { position: relative; height: 46px; border-left: 2px solid var(--text-3); border-right: 4px double var(--text-3); }
  .strings, .played { position: absolute; inset: 0; }
  .played { clip-path: inset(0 calc(100% - var(--p, 0) * 100%) 0 0); }
  i { position: absolute; left: 0; right: 0; top: calc(var(--i) * 9px + 0.5px); height: calc(1px + var(--i) * 0.3px); background: var(--string); }
  .played i { background: var(--finish); }
  .cursor { position: absolute; left: calc(var(--p, 0) * 100%); top: -4px; bottom: -4px; width: 2px; background: var(--text); }
  .played, .cursor { transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
  footer { margin-top: 12px; color: var(--text-3); font-size: 12px; }
  @media (prefers-reduced-motion: reduce) { .played, .cursor { transition: none; } }
</style>
<body>
  <header>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 22.6c-2 0-9.6-10.4-9.6-15C2.4 3.7 6.4 1.6 12 1.6s9.6 2.1 9.6 6c0 4.6-7.6 15-9.6 15Z"/></svg>
    <span class="word">Guitare<span>Course</span></span>
    <span class="kicker">Mise à jour</span>
  </header>
  <main>
    <h1><small>Nouvelle version</small>${version}</h1>
    <p class="percent" role="status"><b id="n">0</b><span> %</span></p>
  </main>
  <div class="staff" id="staff">
    <div class="strings">${strings}</div>
    <div class="played">${strings}</div>
    <div class="cursor"></div>
  </div>
  <footer>L'application redémarre d'elle-même une fois à jour.</footer>
  <script>
    window.progress = (percent) => {
      document.getElementById('staff').style.setProperty('--p', percent / 100)
      document.getElementById('n').textContent = Math.round(percent)
    }
  </script>
</body>
</html>`
}
