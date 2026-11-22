import type { ReactNode } from 'react'

const BODY = 'M100 156C84 156 40 106 40 70C40 47 66 34 100 34S160 47 160 70C160 106 116 156 100 156Z'

/** Sa taille à chaque forme : il grandit, en laissant de la place à l'ampli et à la couronne. */
const SIZES = [0.8, 0.76, 0.82, 0.86, 0.88, 0.74, 0.86, 0.92]

/** La guitare, en travers du corps. */
const GUITAR = 'translate(86 138) rotate(-18)'

/** Une partie qui bouge : un calque de la taille du dessin. */
function Part({ move, children }: { move: string; children: ReactNode }) {
  return <div className={`m-part ${move}`}>{children}</div>
}

/** Un morceau de dessin, immobile dans son calque. */
function Draw({ children }: { children: ReactNode }) {
  return (
    <svg className="m-part" viewBox="0 0 200 196">
      {children}
    </svg>
  )
}

/**
 * Le médiator de l'application, devenu personnage. À chaque forme (voir STAGES), sa silhouette et son
 * mouvement changent (mascot-motion.css).
 *
 * Des calques HTML empilés, et non un seul SVG : Chromium refait la mise en page et le dessin à chaque
 * image quand une partie d'un SVG bouge, alors qu'un calque glisse sur la carte graphique, à la fréquence
 * de l'écran. On n'anime donc que des `Part`, jamais ce qu'il y a dans un `Draw`.
 * `happy` : il a joué aujourd'hui ; sinon il attend.
 */
export function MascotArt({ stage, happy }: { stage: number; happy: boolean }) {
  const root = {
    className: 'mascot-art',
    'aria-hidden': true,
    'data-stage': stage,
    'data-waiting': !happy || undefined,
  }
  const floor = (
    <Draw>
      <path className="m-floor" d="M28 188H172" />
    </Draw>
  )

  if (stage === 0)
    return (
      <div {...root}>
        {floor}
        <div className="m-part m-lying" style={{ scale: SIZES[0] }}>
          <Part move="m-breath">
            <Draw>
              <path className="m-asleep" d={BODY} />
              <path className="m-asleep-line" d="M67 78q11 10 22 0M111 78q11 10 22 0M94 106h12" />
            </Draw>
          </Part>
        </div>
        <Part move="m-z">
          <Draw>
            <path className="m-asleep-line" d="M145 58h14l-14 16h14" />
          </Draw>
        </Part>
        <Part move="m-z">
          <Draw>
            <path className="m-asleep-line" d="M169 28h10l-10 12h10" />
          </Draw>
        </Part>
      </div>
    )

  const onAmp = stage === 5
  const hands = stage === 2 ? { left: [30, 130], right: [176, 78] } : { left: [64, 140], right: [156, 116] }

  return (
    <div {...root}>
      {floor}
      {onAmp && (
        <>
          <Part move="m-waves m-blast">
            <Draw>
              <path d="M38 157q-12 14 0 28M22 151q-18 20 0 40M162 157q12 14 0 28M178 151q18 20 0 40" />
            </Draw>
          </Part>
          <Part move="m-amp">
            <Draw>
              <rect className="m-gear" x="50" y="154" width="100" height="34" rx="5" />
              <path className="m-cut" d="M56 166H144" />
              <path className="m-grille" d="M60 173H140M60 181H140" />
            </Draw>
            <Part move="m-knobs">
              <Draw>
                <path d="M64 160h0M76 160h0M88 160h0" />
              </Draw>
            </Part>
          </Part>
        </>
      )}
      <Part move="m-hero">
        <div className="m-part m-place" style={{ scale: SIZES[stage] }}>
          {stage >= 6 && (
            <div className="m-part">
              <Part move="m-waves">
                <Draw>
                  <path d="M22 62q-18 28 0 56M178 62q18 28 0 56" />
                </Draw>
              </Part>
              <Part move="m-waves">
                <Draw>
                  <path d="M6 48q-28 42 0 84M194 48q28 42 0 84" />
                </Draw>
              </Part>
            </div>
          )}
          <Part move="m-whole">
            {stage === 7 && (
              <Part move="m-cape">
                <Draw>
                  <path d="M62 78L22 174l22-6 14 12 20-8h44l20 8 14-12 22 6L138 78Z" />
                </Draw>
              </Part>
            )}

            <Draw>
              <path className="m-limb" d="M86 144L80 181M114 144L120 181" />
              <path className="m-gear" d="M62 188q0-13 14-13h10v13Z" />
            </Draw>
            <Part move="m-foot">
              <Draw>
                <path className="m-gear" d="M138 188q0-13-14-13h-10v13Z" />
              </Draw>
            </Part>

            <Part move="m-upper">
              {stage >= 2 && (
                <Draw>
                  <path
                    className="m-limb"
                    d={stage === 2 ? 'M50 102Q32 112 30 130M150 102Q172 100 176 78' : 'M50 100Q22 124 64 140M150 100Q180 112 156 116'}
                  />
                </Draw>
              )}
              {stage >= 4 && stage <= 6 && (
                <Part move="m-hair">
                  <Draw>
                    <path
                      className="m-gear"
                      d="M70 42Q62 30 48 26Q70 18 80 24Q76 8 64 2Q92 0 100 18Q106 2 98-10Q126-2 124 22Q136 16 138 6Q152 26 130 44Z"
                    />
                  </Draw>
                </Part>
              )}
              <Draw>
                <path className="m-body" d={BODY} />
                {happy ? (
                  <path className="m-ink" d="M87 92Q100 96 113 92Q112 106 100 106T87 92Z" />
                ) : (
                  <path className="m-mouth" d="M92 101q8-5 16 0" />
                )}
                {stage >= 6 && <path className="m-ink" d="M56 60H144L138 80Q134 88 122 88T106 78L103 70H97L94 78Q90 88 78 88T62 80Z" />}
              </Draw>

              {stage === 1 && (
                <Part move="m-sprout">
                  <Draw>
                    <path d="M100 35C99 18 116 12 119 23C121 31 109 30 111 23" />
                  </Draw>
                </Part>
              )}
              {stage === 7 && (
                <Part move="m-crown">
                  <Draw>
                    <g className="m-gear">
                      <path d="M64 46L58 18 80 30 100 8 120 30 142 18 136 46Q100 34 64 46Z" />
                      <circle cx="58" cy="14" r="7" />
                      <circle cx="100" cy="5" r="7" />
                      <circle cx="142" cy="14" r="7" />
                    </g>
                  </Draw>
                </Part>
              )}

              {stage >= 6 ? (
                <Part move="m-glint">
                  <Draw>
                    <path d="M68 68l6-3M116 68l6-3" />
                  </Draw>
                </Part>
              ) : (
                <Part move="m-eyes">
                  <Draw>
                    <ellipse className="m-eye" cx="78" cy="72" rx="14" ry="16" />
                    <ellipse className="m-eye" cx="122" cy="72" rx="14" ry="16" />
                  </Draw>
                  <Part move="m-look">
                    <Draw>
                      <circle className="m-ink" cx="81" cy={happy ? 72 : 77} r="7" />
                      <circle className="m-ink" cx="119" cy={happy ? 72 : 77} r="7" />
                    </Draw>
                  </Part>
                </Part>
              )}

              {stage === 2 && (
                <>
                  <Draw>
                    <path className="m-band" d="M42 72C36 14 164 14 158 72" />
                    <rect className="m-gear" x="28" y="58" width="19" height="32" rx="9" />
                    <rect className="m-gear" x="153" y="58" width="19" height="32" rx="9" />
                  </Draw>
                  <Part move="m-notes">
                    <Draw>
                      <path className="m-note" d="M180 42V20l14-4v21" />
                      <circle className="m-note-head" cx="175" cy="43" r="6" />
                      <circle className="m-note-head" cx="189" cy="38" r="6" />
                    </Draw>
                  </Part>
                </>
              )}

              {stage >= 3 && (
                <>
                  <Draw>
                    <g transform={GUITAR}>
                      <path className="m-neck" d="M14-5H88V5H14ZM86-8h22l4 8-4 8H86Z" />
                      {stage === 3 ? (
                        <path className="m-guitar" d="M28 0C28-17 12-20 2-12C-8-28-38-25-38 0S-8 28 2 12C12 20 28 17 28 0Z" />
                      ) : (
                        <path className="m-guitar" d="M30-7L4-10-40-24-18 0-40 24 4 10 30 7Z" />
                      )}
                      <circle className="m-ink" cx="4" cy="0" r={stage === 3 ? 7 : 4} />
                    </g>
                  </Draw>
                  <Part move="m-strings">
                    <Draw>
                      <path transform={GUITAR} d="M-22-2H106M-22 2H106" />
                    </Draw>
                  </Part>
                </>
              )}
              {stage >= 2 && (
                <>
                  <Part move="m-pick-hand">
                    <Draw>
                      <circle className="m-body m-hand" cx={hands.left[0]} cy={hands.left[1]} r="9" />
                    </Draw>
                  </Part>
                  <Part move="m-fret-hand">
                    <Draw>
                      <circle className="m-body m-hand" cx={hands.right[0]} cy={hands.right[1]} r="9" />
                    </Draw>
                  </Part>
                </>
              )}
            </Part>
          </Part>
        </div>
      </Part>
    </div>
  )
}
