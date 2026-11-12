/**
 * Ilustraciones de las tapas gráficas (sin foto). Dibujos propios, planos y
 * de pocas tintas, en SVG: se pintan con los colores de la paleta elegida y
 * salen nítidos a cualquier tamaño (visor y PDF de imprenta).
 *
 * Cada dibujo vive en un lienzo de 200×200 y recibe tres colores:
 * fg (trazo/figura principal), accent (detalle) y bg (recortes del fondo).
 */
import type { ReactElement } from 'react'

export interface ArtColors { fg: string; accent: string; bg: string }

export interface CoverArt {
  id: string
  name: string
  /** Para ordenar la galería según la ocasión del álbum. */
  tags: string[]
  draw: (c: ArtColors) => ReactElement
}

const line = (c: string, w = 2.6) => ({ fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

export const COVER_ART: CoverArt[] = [
  {
    id: 'montanas', name: 'Montañas', tags: ['viaje', 'familia'],
    draw: ({ fg, accent, bg }) => (
      <>
        <circle cx="138" cy="66" r="24" fill={accent} />
        <path d="M8 168 L70 78 L112 136 L134 108 L192 168 Z" fill={fg} opacity="0.55" />
        <path d="M40 168 L104 70 L168 168 Z" fill={fg} />
        <path d="M104 70 L90 92 L98 88 L104 96 L111 87 L118 92 Z" fill={bg} />
        <path d="M60 182 H140" {...line(fg, 2)} opacity="0.6" />
      </>
    ),
  },
  {
    id: 'playa', name: 'Playa', tags: ['viaje'],
    draw: ({ fg, accent }) => (
      <>
        <path d="M44 112 A56 56 0 0 1 156 112 Z" fill={accent} />
        <path d="M20 124 Q40 112 60 124 T100 124 T140 124 T180 124" {...line(fg, 4)} />
        <path d="M34 146 Q52 136 70 146 T106 146 T142 146 T170 146" {...line(fg, 4)} opacity="0.75" />
        <path d="M52 166 Q66 158 80 166 T108 166 T136 166 T150 166" {...line(fg, 4)} opacity="0.5" />
      </>
    ),
  },
  {
    id: 'palmera', name: 'Palmera', tags: ['viaje'],
    draw: ({ fg, accent }) => (
      <>
        <circle cx="62" cy="70" r="22" fill={accent} />
        <path d="M108 176 C112 140 116 104 112 66" {...line(fg, 6)} />
        <path d="M112 66 C90 54 70 58 56 76 C76 68 94 68 112 66 Z" fill={fg} />
        <path d="M112 66 C130 50 152 50 168 64 C148 62 130 64 112 66 Z" fill={fg} />
        <path d="M112 66 C104 46 106 30 118 18 C114 36 114 52 112 66 Z" fill={fg} />
        <path d="M112 66 C132 70 146 84 150 104 C138 88 126 76 112 66 Z" fill={fg} />
        <path d="M112 66 C94 74 84 90 84 108 C92 92 100 80 112 66 Z" fill={fg} />
        <path d="M70 178 Q110 166 150 178" {...line(fg, 3)} opacity="0.6" />
      </>
    ),
  },
  {
    id: 'avion', name: 'Avión', tags: ['viaje'],
    draw: ({ fg, accent }) => (
      <>
        <path d="M24 150 C50 170 80 160 92 136 C102 116 82 104 72 118 C62 132 90 146 118 128" {...line(accent, 2.6)} strokeDasharray="5 7" />
        <g transform="translate(138 92) rotate(-32)">
          <path d="M-34 0 C-34 -5 -28 -7 -20 -7 L30 -7 C38 -7 42 -3 42 0 C42 3 38 7 30 7 L-20 7 C-28 7 -34 5 -34 0 Z" fill={fg} />
          <path d="M-2 -7 L-20 -40 L-8 -40 L22 -7 Z" fill={fg} />
          <path d="M-2 7 L-20 40 L-8 40 L22 7 Z" fill={fg} />
          <path d="M-30 -6 L-38 -22 L-30 -22 L-20 -6 Z" fill={fg} />
        </g>
      </>
    ),
  },
  {
    id: 'brujula', name: 'Brújula', tags: ['viaje', 'familia'],
    draw: ({ fg, accent }) => (
      <>
        <circle cx="100" cy="100" r="64" {...line(fg, 3)} />
        <circle cx="100" cy="100" r="54" {...line(fg, 1.4)} opacity="0.6" />
        {[0, 90, 180, 270].map(a => (
          <path key={a} d="M100 40 V50" {...line(fg, 3)} transform={`rotate(${a} 100 100)`} />
        ))}
        <path d="M100 56 L112 100 L100 144 L88 100 Z" fill={fg} />
        <path d="M100 56 L112 100 L88 100 Z" fill={accent} />
        <circle cx="100" cy="100" r="5" fill={fg} />
      </>
    ),
  },
  {
    id: 'anillos', name: 'Anillos', tags: ['boda', 'aniversario'],
    draw: ({ fg, accent }) => (
      <>
        <circle cx="82" cy="116" r="40" {...line(fg, 5)} />
        <circle cx="122" cy="116" r="40" {...line(fg, 5)} />
        <path d="M110 54 L122 42 L134 54 L122 72 Z" fill={accent} />
        <path d="M110 54 H134" {...line(fg, 1.6)} opacity="0.5" />
      </>
    ),
  },
  {
    id: 'ramo', name: 'Flores', tags: ['boda', 'aniversario', 'familia'],
    draw: ({ fg, accent }) => {
      const flower = (cx: number, cy: number, r: number) => (
        <g>
          {[0, 72, 144, 216, 288].map(a => (
            <ellipse key={a} cx={cx} cy={cy - r} rx={r * 0.55} ry={r} fill={accent} transform={`rotate(${a} ${cx} ${cy})`} />
          ))}
          <circle cx={cx} cy={cy} r={r * 0.45} fill={fg} />
        </g>
      )
      return (
        <>
          <path d="M100 178 C98 140 78 110 70 82" {...line(fg, 3)} />
          <path d="M100 178 C102 136 104 104 104 66" {...line(fg, 3)} />
          <path d="M100 178 C104 142 124 114 136 92" {...line(fg, 3)} />
          <path d="M88 130 C74 124 66 112 66 100 C80 104 88 114 88 130 Z" fill={fg} />
          <path d="M112 140 C126 132 134 120 134 108 C120 112 112 124 112 140 Z" fill={fg} />
          {flower(70, 80, 15)}
          {flower(104, 62, 17)}
          {flower(137, 90, 14)}
        </>
      )
    },
  },
  {
    id: 'corazon', name: 'Corazón', tags: ['boda', 'aniversario', 'familia'],
    draw: ({ fg, accent }) => (
      <>
        <path d="M100 160 C60 130 36 106 36 80 C36 60 52 46 70 46 C84 46 94 54 100 66 C106 54 116 46 130 46 C148 46 164 60 164 80 C164 106 140 130 100 160 Z" {...line(fg, 4)} />
        <path d="M100 138 C78 120 64 106 64 90 C64 80 72 72 82 72 C90 72 96 77 100 84 C104 77 110 72 118 72 C128 72 136 80 136 90 C136 106 122 120 100 138 Z" fill={accent} />
      </>
    ),
  },
  {
    id: 'globos', name: 'Globos', tags: ['bebe-mensual', 'familia', 'cumple'],
    draw: ({ fg, accent }) => (
      <>
        <path d="M76 104 C80 130 96 150 100 176" {...line(fg, 1.8)} />
        <path d="M126 92 C120 124 104 150 100 176" {...line(fg, 1.8)} />
        <path d="M100 116 V176" {...line(fg, 1.8)} />
        <ellipse cx="76" cy="76" rx="26" ry="31" fill={accent} />
        <ellipse cx="126" cy="64" rx="26" ry="31" fill={fg} />
        <ellipse cx="100" cy="90" rx="24" ry="29" fill={fg} opacity="0.7" />
        <path d="M66 62 C68 54 74 50 80 50" {...line('#FFFFFF', 3)} opacity="0.55" />
      </>
    ),
  },
  {
    id: 'luna', name: 'Luna', tags: ['bebe-mensual', 'familia'],
    draw: ({ fg, accent }) => {
      const star = (x: number, y: number, s: number) => (
        <path d={`M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`} fill={accent} />
      )
      return (
        <>
          <path d="M120 40 C84 46 62 76 66 112 C70 146 100 168 134 164 C112 156 96 134 96 106 C96 76 108 52 120 40 Z" fill={fg} />
          {star(140, 70, 9)}
          {star(156, 116, 6)}
          {star(48, 60, 5)}
          {star(132, 146, 4)}
        </>
      )
    },
  },
  {
    id: 'hogar', name: 'Hogar', tags: ['familia', 'aniversario'],
    draw: ({ fg, accent }) => (
      <>
        <path d="M46 98 L100 52 L154 98" {...line(fg, 5)} />
        <path d="M60 88 V164 H140 V88" {...line(fg, 5)} />
        <path d="M88 164 V126 H112 V164" {...line(fg, 4)} />
        <path d="M100 108 C92 102 86 98 86 92 C86 88 89 85 93 85 C96 85 98 87 100 90 C102 87 104 85 107 85 C111 85 114 88 114 92 C114 98 108 102 100 108 Z" fill={accent} />
        <path d="M30 164 H170" {...line(fg, 3)} opacity="0.6" />
      </>
    ),
  },
  {
    id: 'huella', name: 'Huella', tags: ['mascota'],
    draw: ({ fg, accent }) => (
      <>
        <path d="M100 168 C76 168 62 154 66 138 C70 122 86 112 100 112 C114 112 130 122 134 138 C138 154 124 168 100 168 Z" fill={fg} />
        <ellipse cx="62" cy="98" rx="13" ry="17" fill={fg} transform="rotate(-20 62 98)" />
        <ellipse cx="86" cy="72" rx="13" ry="18" fill={fg} transform="rotate(-8 86 72)" />
        <ellipse cx="114" cy="72" rx="13" ry="18" fill={fg} transform="rotate(8 114 72)" />
        <ellipse cx="138" cy="98" rx="13" ry="17" fill={fg} transform="rotate(20 138 98)" />
        <path d="M150 40 C144 36 140 34 140 30 C140 27 142 25 145 25 C147 25 149 26 150 28 C151 26 153 25 155 25 C158 25 160 27 160 30 C160 34 156 36 150 40 Z" fill={accent} />
      </>
    ),
  },
  {
    id: 'pastel', name: 'Pastel', tags: ['cumple', 'bebe-mensual', 'familia'],
    draw: ({ fg, accent }) => (
      <>
        <path d="M54 112 H146 V164 H54 Z" fill={fg} />
        <path d="M54 124 C66 134 76 116 88 128 C100 138 110 118 122 128 C134 138 140 122 146 124 V112 H54 Z" fill={accent} />
        <path d="M44 164 H156" {...line(fg, 4)} />
        {[78, 100, 122].map(x => (
          <g key={x}>
            <rect x={x - 3} y="82" width="6" height="30" rx="2" fill={accent} />
            <path d={`M${x} 64 C${x + 7} 72 ${x + 5} 80 ${x} 80 C${x - 5} 80 ${x - 7} 72 ${x} 64 Z`} fill={fg} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: 'sol', name: 'Sol', tags: ['viaje', 'familia', 'cumple'],
    draw: ({ fg, accent }) => (
      <>
        <circle cx="100" cy="100" r="34" fill={accent} />
        {Array.from({ length: 12 }, (_, i) => i * 30).map(a => (
          <path key={a} d="M100 50 V30" {...line(fg, 4)} transform={`rotate(${a} 100 100)`} />
        ))}
      </>
    ),
  },
]

const BY_ID = new Map(COVER_ART.map(a => [a.id, a]))
export const getArt = (id: string | undefined) => (id ? BY_ID.get(id) : undefined)

/** Ilustraciones ordenadas: primero las que van con la ocasión. */
export function artForOccasion(occasion: string): CoverArt[] {
  return [...COVER_ART].sort((a, b) => Number(b.tags.includes(occasion)) - Number(a.tags.includes(occasion)))
}

export function CoverArtSvg({ id, colors, style }: { id: string; colors: ArtColors; style?: React.CSSProperties }) {
  const art = getArt(id)
  if (!art) return null
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', ...style }} aria-hidden>
      {art.draw(colors)}
    </svg>
  )
}
