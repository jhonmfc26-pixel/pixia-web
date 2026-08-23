import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { DedicationContent } from '@/core/modules/foldModel/types'
import { getHeadingFontFamily, getBodyFontFamily } from './fonts'

// Textura de papel MUY sutil vía SVG de ruido inline (data-URI) — no es una
// imagen real, pesa unos bytes de texto, sin requests ni assets externos.
// Alpha bajísimo (0.022) a propósito: apenas un grano, nunca "sucio". Si en
// producción se ve ruidosa, basta con borrar backgroundImage de PAPER_STYLE.
const PAPER_TEXTURE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.55 0 0 0 0 0.47 0 0 0 0 0.36 0 0 0 0.022 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

// Tierra/sepia — el hilo conductor del marco, el ornamento y los acentos.
const INK_HEADING = '#6b5842'
const INK_BODY = '#4a4038'
const EARTH_LINE = 'rgba(140,120,90,0.28)'

/**
 * Render de la carta — ÚNICO componente para editor (FaceReadView) y viewer
 * 3D (FacePageView vía SpreadFaces.tsx): mismo componente, misma tipografía,
 * mismo layout — lo que el usuario edita es exactamente lo que se imprime.
 * Puramente presentacional, sin interactividad propia (clicks/selección los
 * maneja quien la envuelve en cada contexto).
 *
 * containerType:'inline-size' + unidades cqw: la carta vive en cajas de
 * tamaño MUY distinto según el contexto (miniatura del editor vs página
 * completa del viewer) — cqw escala el texto relativo a SU propia caja, no
 * al viewport, así se ve proporcionado en ambos lados sin lógica extra.
 */
export function DedicationCard({ dedication, photo }: {
  dedication: DedicationContent
  photo?: PhotoAsset
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%', height: '100%',
        background: '#F6F1E8', // crema cálido — no blanco, no crema frío
        backgroundImage: `url("${PAPER_TEXTURE}")`,
        boxSizing: 'border-box',
        containerType: 'inline-size',
      } as React.CSSProperties}
    >
      {/* Marco interior sutil — el filo de una tarjeta impresa, no un div */}
      <div style={{
        position: 'absolute', inset: '5.5%',
        border: '0.5px solid ' + EARTH_LINE,
        pointerEvents: 'none',
      }} />

      {/* Contenido — centrado vertical, con aire generoso arriba y abajo */}
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '15% 14%',
        boxSizing: 'border-box',
        textAlign: 'center',
        gap: '5.5%',
      }}>
        <h2 style={{
          margin: 0,
          fontFamily: getHeadingFontFamily(dedication.headingFont),
          fontSize: 'clamp(22px, 8.5cqw, 50px)',
          fontWeight: 400,
          color: INK_HEADING,
          lineHeight: 1.2,
          maxWidth: '100%',
          overflowWrap: 'break-word',
        }}>
          {dedication.heading || 'Sin título'}
        </h2>

        {photo && (
          <div style={{
            width: '30%', aspectRatio: '1',
            borderRadius: '2px',
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(74,64,50,0.18)',
            border: '1px solid ' + EARTH_LINE,
            flexShrink: 0,
          }}>
            <img
              src={photo.thumbnailUrl || photo.url}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        {/* Ornamento — un solo separador discreto, nunca más de uno */}
        {(dedication.body || dedication.signature) && (
          <div style={{
            fontSize: 'clamp(9px, 1.8cqw, 13px)',
            letterSpacing: '0.35em',
            color: EARTH_LINE,
          }}>
            · · ·
          </div>
        )}

        {dedication.body && (
          <p style={{
            margin: 0,
            fontFamily: getBodyFontFamily(dedication.bodyFont),
            fontSize: 'clamp(11px, 2.9cqw, 17px)',
            lineHeight: 1.75,
            letterSpacing: '0.2px',
            color: INK_BODY,
            whiteSpace: 'pre-wrap',
            maxWidth: '84%',
          }}>
            {dedication.body}
          </p>
        )}

        {dedication.signature && (
          <p style={{
            margin: 0,
            fontFamily: getBodyFontFamily(dedication.bodyFont),
            fontStyle: 'italic',
            fontSize: 'clamp(13px, 3.2cqw, 19px)',
            color: INK_HEADING,
            textAlign: 'right',
            width: '84%',
          }}>
            {dedication.signature}
          </p>
        )}
      </div>
    </div>
  )
}
