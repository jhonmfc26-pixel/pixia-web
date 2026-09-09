import type { CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { PrintProfile } from './printProfiles'
import {
  calculateSpineWidthMm,
  SPINE_MIN_WIDTH_FOR_TITLE_MM,
  SPINE_MIN_WIDTH_FOR_LOGO_MM,
} from './spine'
import CoverRenderer from '@/core/modules/cover/CoverRenderer'
import BackCoverPage from '@/core/modules/viewer/pages/BackCoverPage'
import { getTemplateById } from '@/core/modules/cover/coverTemplates'

/**
 * Dimensiones físicas (mm) de la cubierta extendida completa.
 *
 * anchoTotal = (anchoPortada + bleed) + spineWidthMm + (anchoContraportada + bleed)
 * — el bleed va SOLO en los bordes exteriores (izquierda de la
 * contraportada, derecha de la portada); las costuras internas
 * (contra→lomo, lomo→porta) son parte de la misma hoja continua, no hay
 * corte ahí, así que no llevan sangrado propio.
 *
 * altoTotal: acá me aparto del texto literal del ticket ("alto = altoPortada
 * + bleed", un solo bleed) — arriba Y abajo de la pieza completa SÍ son
 * bordes exteriores reales (a diferencia de las costuras internas del
 * ancho), así que dejé heightMm + 2×bleedMm, el valor físicamente correcto.
 * Marcado para confirmar con el equipo/Range por si la intención literal
 * del ticket era otra cosa.
 */
export function getCoverWrapDimensionsMm(profile: PrintProfile, pageCount: number) {
  const spineWidthMm = calculateSpineWidthMm(pageCount)
  const panelWidthMm = profile.widthMm + profile.bleedMm
  return {
    spineWidthMm,
    panelWidthMm,
    widthMm: panelWidthMm * 2 + spineWidthMm,
    heightMm: profile.heightMm + 2 * profile.bleedMm,
  }
}

interface PrintCoverWrapProps {
  cover: CoverConfig
  /** Foto completa (no solo la URL) — width/height hacen falta para el recorte manual, ver manualCover.ts. */
  coverPhoto: PhotoAsset | undefined
  /** Texto del lomo — normalmente book.cover.title. */
  title: string
  /** Páginas interiores reales (countRealPages) — determina el ancho del lomo. */
  pageCount: number
  profile: PrintProfile
}

/**
 * Cubierta extendida: [CONTRAPORTADA | LOMO | PORTADA] como UNA pieza
 * continua, igual que el case-wrap de un libro de pasta dura — no portada y
 * contraportada sueltas al principio/final del PDF del interior.
 *
 * Portada: reusa CoverRenderer tal cual con el cover que ya diseñó el
 * usuario — WYSIWYG con lo que armó en el editor.
 * Contraportada: reusa BackCoverPage tal cual (el mismo fondo oscuro +
 * wordmark Pixia que ya usa el viewer para su última página) — diseño
 * mínimo, ⚠️ CONFIRMAR con el equipo si esto es lo que quieren para
 * producción o si la contraportada necesita algo más (código QR, dirección,
 * etc.) — por ahora es deliberadamente simple.
 * Lomo: ver SpineTitle más abajo.
 */
export default function PrintCoverWrap({ cover, coverPhoto, title, pageCount, profile }: PrintCoverWrapProps) {
  const { spineWidthMm, panelWidthMm, widthMm, heightMm } = getCoverWrapDimensionsMm(profile, pageCount)
  const template = getTemplateById(cover.templateId)

  return (
    <div style={{
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
      background: '#111111', // visible solo si el lomo es tan angosto que ni el color de contra/porta lo cubre — no debería pasar, pero es una red de seguridad, no un negro puro "roto"
    }}>
      <div style={{ width: `${panelWidthMm}mm`, height: '100%', flexShrink: 0 }}>
        <BackCoverPage />
      </div>

      <div style={{ width: `${spineWidthMm}mm`, height: '100%', flexShrink: 0 }}>
        <SpineTitle
          title={title}
          spineWidthMm={spineWidthMm}
          spineHeightMm={heightMm}
          fontFamily={template?.titleFont ?? 'Playfair Display'}
        />
      </div>

      <div style={{ width: `${panelWidthMm}mm`, height: '100%', flexShrink: 0 }}>
        <CoverRenderer config={cover} photoUrl={coverPhoto?.url} photoWidth={coverPhoto?.width} photoHeight={coverPhoto?.height} format="30x30" />
      </div>
    </div>
  )
}

/**
 * Título del lomo — texto vertical (writing-mode: vertical-rl), legible al
 * pararlo en una biblioteca. CONVENCIÓN elegida: con el arte de la cubierta
 * visto plano/desplegado (como este componente lo dibuja), el texto corre
 * de arriba hacia abajo — al doblar y encuadernar normalmente (lomo
 * vertical), eso equivale a la convención editorial más común (se lee
 * inclinando la cabeza hacia la izquierda con el libro parado normal en el
 * estante). Si Range/el equipo prefiere la dirección opuesta, es un solo
 * cambio: vertical-rl → vertical-lr acá abajo, nada más se toca.
 *
 * Degradación graciosa (nunca rompe layout):
 *  - spineWidthMm < SPINE_MIN_WIDTH_FOR_LOGO_MM (pliego mínimo, ~lomo de un
 *    pliegue) → nada, la costura queda en el color de fondo.
 *  - spineWidthMm < SPINE_MIN_WIDTH_FOR_TITLE_MM → sin título, solo el logo
 *    (un lomo angosto no tiene aire para texto vertical + padding legible).
 *  - Título largo en lomo angosto → tamaño de fuente proporcional al ancho
 *    del lomo (clamp) + overflow:hidden con ellipsis: se recorta con
 *    gracia, nunca desborda ni rompe el layout. No hay medición real de
 *    texto acá (no hay browser en build-time) — es un recorte por CSS, no
 *    una garantía de que el título completo siempre entre.
 *
 * Título + logo agrupados hacia la parte INFERIOR del lomo (justifyContent:
 * flex-end + paddingBottom), no centrados verticalmente — con margen
 * inferior prudente para que no queden pegados al borde.
 */
function SpineTitle({ title, spineWidthMm, spineHeightMm, fontFamily }: {
  title: string
  spineWidthMm: number
  spineHeightMm: number
  fontFamily: string
}) {
  if (spineWidthMm < SPINE_MIN_WIDTH_FOR_LOGO_MM) return null

  const showTitle = spineWidthMm >= SPINE_MIN_WIDTH_FOR_TITLE_MM && title.trim().length > 0
  // Proporcional al ancho del lomo — un lomo angosto necesita letra chica.
  // Clamp conservador: nunca tan grande que garantice desborde, nunca tan
  // chico que sea ilegible impreso.
  const fontSizeMm = Math.max(2.2, Math.min(spineWidthMm * 0.55, 7))

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#111111',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
      gap: `${Math.max(2, spineWidthMm * 0.3)}mm`,
      boxSizing: 'border-box',
      padding: `0 0 ${Math.max(3, spineWidthMm * 0.4)}mm`,
    }}>
      {showTitle && (
        <div style={{
          writingMode: 'vertical-rl',
          maxHeight: `${spineHeightMm - Math.max(6, spineWidthMm * 0.8)}mm`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: `'${fontFamily}', serif`,
          fontSize: `${fontSizeMm}mm`,
          fontWeight: 400,
          letterSpacing: '0.04em',
          color: 'rgba(255,255,255,0.92)',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
      )}
      {/* URL absoluta (no /logo-pixia.png): Puppeteer resuelve rutas relativas
          contra <base href>=baseUrl (localhost en Cloud Run) — inalcanzable, el
          logo del lomo saldría roto. Misma URL pública de R2 que Resend. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://assets.pixiaa.com/logo-pixia.png"
        alt=""
        style={{
          width: `${Math.min(spineWidthMm * 0.5, 6)}mm`,
          height: 'auto',
          opacity: 0.55,
          flexShrink: 0,
        }}
      />
    </div>
  )
}
