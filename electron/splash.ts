// La petite fenêtre de mise à jour, comme les autres fenêtres de l'application : coins arrondis, filet,
// l'intitulé dans la couleur choisie, le titre en DIN, un filet sous l'en-tête. La progression s'y lit sur une
// portée à six cordes, comme la barre de lecture : la partie téléchargée prend la couleur.
// Pendant l'installation, l'application est fermée : une fenêtre Windows identique (installingScript) prend
// le relais jusqu'à ce que la nouvelle version s'ouvre.

export type Theme = 'dark' | 'light'

export const SPLASH_SIZE = { width: 460, height: 244 }

/** Fond de la fenêtre avant l'affichage de la page, pour éviter un éclair d'une autre couleur. */
export const BACKGROUND: Record<Theme, string> = { dark: '#101010', light: '#fbfaf7' }

/** Fiesta Red, la couleur de l'application quand on n'en a pas choisi d'autre (tokens.css). */
const FIESTA: Record<Theme, string> = { dark: '#ff5636', light: '#cf300c' }

/** Les couleurs de tokens.css, en #AARRGGBB (la notation de Windows). */
function palette(theme: Theme, finish: string | undefined) {
  const dark = theme === 'dark'
  return {
    panel: `#FF${BACKGROUND[theme].slice(1)}`,
    text: dark ? '#FFF5F5F2' : '#FF141413',
    text3: dark ? '#FF8C8C87' : '#FF66665F',
    line: dark ? '#1AFFFFFF' : '#1A000000',
    lineStrong: dark ? '#42FFFFFF' : '#47000000',
    string: dark ? '#4DFFFFFF' : '#47000000',
    finish: `#FF${(finish ?? FIESTA[theme]).slice(1)}`,
  }
}

/** #AARRGGBB → #RRGGBBAA, pour le CSS. */
const css = (color: string) => `#${color.slice(3)}${color.slice(1, 3)}`

/** Le médiator du logo. */
const PICK = 'M12 22.6c-2 0-9.6-10.4-9.6-15C2.4 3.7 6.4 1.6 12 1.6s9.6 2.1 9.6 6c0 4.6-7.6 15-9.6 15Z'

/**
 * Page de la fenêtre ; `window.progress(pourcentage)` la fait avancer, `window.installing()` passe à
 * l'installation. `finish` : la couleur choisie dans l'application (#RRGGBB).
 */
export function splashPage(version: string, theme: Theme, finish?: string): string {
  const c = palette(theme, finish)
  const strings = Array.from({ length: 6 }, (_, i) => `<i style="--i:${i}"></i>`).join('')
  return `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<title>Mise à jour de GuitareCourse</title>
<style>
  @font-face { font-family: 'GC DIN'; src: local('Bahnschrift'); font-weight: 300 700; font-stretch: 75% 100%; }
  :root {
    --panel: ${css(c.panel)}; --line: ${css(c.line)}; --line-strong: ${css(c.lineStrong)}; --string: ${css(c.string)};
    --text: ${css(c.text)}; --text-3: ${css(c.text3)}; --finish: ${css(c.finish)};
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; overflow: hidden; background: transparent; }
  body {
    display: grid; grid-template-rows: auto 1fr auto; padding: 22px 24px 20px;
    border: 1px solid var(--line-strong); border-radius: 20px; background: var(--panel); color: var(--text);
    font: 500 14px/1.3 'GC DIN', Bahnschrift, sans-serif; user-select: none; -webkit-app-region: drag;
  }
  header { display: flex; align-items: end; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  .kicker { display: flex; align-items: center; gap: 6px; color: var(--finish); font-size: 11px; font-weight: 600; font-stretch: 82%; letter-spacing: 0.14em; text-transform: uppercase; }
  .kicker svg { width: 12px; height: 12px; }
  h1 { margin-top: 10px; font-weight: 600; font-stretch: 87.5%; font-size: 32px; line-height: 1; letter-spacing: -0.02em; }
  .percent { font-weight: 700; font-stretch: 80%; font-size: 40px; line-height: 0.8; font-variant-numeric: tabular-nums; }
  .percent span { color: var(--text-3); font-size: 18px; font-weight: 500; }
  .staff { position: relative; align-self: center; height: 46px; border-left: 2px solid var(--text-3); border-right: 4px double var(--text-3); }
  .strings, .played { position: absolute; inset: 0; }
  .played { clip-path: inset(0 calc(100% - var(--p, 0) * 100%) 0 0); }
  i { position: absolute; left: 0; right: 0; top: calc(var(--i) * 9px + 0.5px); height: calc(1px + var(--i) * 0.3px); background: var(--string); }
  .played i { background: var(--finish); }
  .cursor { position: absolute; left: calc(var(--p, 0) * 100%); top: -4px; bottom: -4px; width: 2px; background: var(--text); }
  .played, .cursor { transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
  footer { color: var(--text-3); font-size: 12px; }
  /* L'installation : les cordes restent pleines, la tête de lecture va et vient. */
  .installing .percent { display: none; }
  .installing .cursor { transition: none; animation: sweep 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite alternate; }
  @keyframes sweep { from { left: 0; } to { left: calc(100% - 2px); } }
  @media (prefers-reduced-motion: reduce) { .played, .cursor { transition: none; } .installing .cursor { animation: none; } }
</style>
<body>
  <header>
    <div>
      <p class="kicker"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${PICK}"/></svg><span id="kicker">Mise à jour</span></p>
      <h1>Version ${version}</h1>
    </div>
    <p class="percent" role="status"><b id="n">0</b><span> %</span></p>
  </header>
  <div class="staff" id="staff">
    <div class="strings">${strings}</div>
    <div class="played">${strings}</div>
    <div class="cursor"></div>
  </div>
  <footer id="footer" role="status">Téléchargement… L'application redémarre d'elle-même une fois à jour.</footer>
  <script>
    window.progress = (percent) => {
      document.getElementById('staff').style.setProperty('--p', percent / 100)
      document.getElementById('n').textContent = Math.round(percent)
    }
    window.installing = () => {
      window.progress(100)
      document.body.classList.add('installing')
      document.getElementById('kicker').textContent = 'Installation'
      document.getElementById('footer').textContent = "Mise à jour en cours… L'application va se relancer."
    }
  </script>
</body>
</html>`
}

/**
 * Script PowerShell de la fenêtre affichée pendant l'installation : la même que la page à l'étape
 * « installing », à la même place. Elle se ferme quand le fichier `marker` disparaît (la nouvelle version
 * est ouverte) ou au bout de trois minutes (installation échouée). Elle crée `marker.shown` une fois visible.
 */
export function installingScript(version: string, theme: Theme, finish: string | undefined, bounds: Electron.Rectangle, marker: string): string {
  const c = palette(theme, finish)
  const quote = (text: string) => `'${text.replaceAll("'", "''")}'`
  const strings = Array.from(
    { length: 6 },
    (_, i) => `<Rectangle Canvas.Top="${i * 9 + 0.5}" Height="${(1 + i * 0.3).toFixed(1)}" Width="{Binding ActualWidth, ElementName=Staff}" Fill="${c.finish}"/>`,
  ).join('')
  // Les dimensions de la fenêtre moins le contour, le rembourrage et les deux barres de la portée.
  const sweep = SPLASH_SIZE.width - 2 - 48 - 2 - 6 - 2
  const xaml = `<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
  Title="Mise à jour de GuitareCourse" WindowStyle="None" AllowsTransparency="True" Background="Transparent"
  ResizeMode="NoResize" ShowInTaskbar="True" Topmost="True"
  Left="${bounds.x}" Top="${bounds.y}" Width="${bounds.width}" Height="${bounds.height}">
  <Border CornerRadius="20" BorderThickness="1" BorderBrush="${c.lineStrong}" Background="${c.panel}" Padding="24,22,24,20">
    <Grid>
      <Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
      <Border BorderThickness="0,0,0,1" BorderBrush="${c.line}" Padding="0,0,0,16">
        <StackPanel>
          <StackPanel Orientation="Horizontal">
            <Viewbox Width="12" Height="12" Margin="0,0,6,0"><Path Fill="${c.finish}" Data="${PICK}"/></Viewbox>
            <TextBlock Text="INSTALLATION" Foreground="${c.finish}" FontFamily="Bahnschrift SemiBold Condensed" FontSize="11"/>
          </StackPanel>
          <TextBlock Text="Version ${version}" Margin="0,8,0,0" Foreground="${c.text}" FontFamily="Bahnschrift SemiBold SemiCondensed" FontSize="32"/>
        </StackPanel>
      </Border>
      <Border Grid.Row="1" VerticalAlignment="Center" Height="46" BorderThickness="2,0,0,0" BorderBrush="${c.text3}">
        <Grid>
          <Canvas x:Name="Staff" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Margin="0,0,6,0">${strings}
            <Rectangle Canvas.Top="-4" Width="2" Height="54" Fill="${c.text}">
              <Rectangle.Triggers>
                <EventTrigger RoutedEvent="Loaded"><BeginStoryboard><Storyboard>
                  <DoubleAnimation Storyboard.TargetProperty="(Canvas.Left)" From="0" To="${sweep}" Duration="0:0:1.6" AutoReverse="True" RepeatBehavior="Forever">
                    <DoubleAnimation.EasingFunction><SineEase EasingMode="EaseInOut"/></DoubleAnimation.EasingFunction>
                  </DoubleAnimation>
                </Storyboard></BeginStoryboard></EventTrigger>
              </Rectangle.Triggers>
            </Rectangle>
          </Canvas>
          <Border HorizontalAlignment="Right" Width="4" BorderThickness="1,0,1,0" BorderBrush="${c.text3}"/>
        </Grid>
      </Border>
      <TextBlock Grid.Row="2" Text="Mise à jour en cours… L'application va se relancer." Foreground="${c.text3}" FontFamily="Bahnschrift" FontSize="12"/>
    </Grid>
  </Border>
</Window>`
  return `Add-Type -AssemblyName PresentationFramework
$marker = ${quote(marker)}
$window = [Windows.Markup.XamlReader]::Parse(${quote(xaml)})
$window.Add_ContentRendered({ New-Item -ItemType File -Force -Path "$marker.shown" | Out-Null })
$start = Get-Date
$timer = New-Object Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(300)
$timer.Add_Tick({ if (-not (Test-Path -LiteralPath $marker) -or ((Get-Date) - $start).TotalMinutes -gt 3) { $window.Close() } })
$timer.Start()
[void]$window.ShowDialog()
Remove-Item -LiteralPath "$marker.shown" -Force -ErrorAction SilentlyContinue
`
}
