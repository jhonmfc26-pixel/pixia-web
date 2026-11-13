import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import { caseColors } from '@/core/modules/cover/coverDesign'

interface BackCoverPageProps {
  style?: string
  /** La contraportada toma el color de la tapa elegido en el estudio de portada. Sin cover: la de siempre (#111). */
  cover?: CoverConfig
}

export default function BackCoverPage({ cover }: BackCoverPageProps) {
  const c = caseColors(cover)
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', background: c.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      // Todo en % del ancho de la contraportada (cqw): el mismo diseño en el
      // visor (cientos de px) y en el PDF (213–303 mm).
      containerType: 'inline-size',
    }}>
      {/* URL absoluta a propósito (no /logo-pixia.png): este componente también
          se renderiza vía PrintCoverWrap dentro del pipeline PDF del contenedor
          (Puppeteer + <base href> apuntando a localhost en Cloud Run) — una ruta
          relativa ahí resuelve contra un origen inalcanzable y el logo sale roto.
          Misma URL pública de R2 que usan los correos Resend.

          Tamaño: el PNG (1024 px) trae ~22 % de margen transparente por lado,
          así que al 26 % del ancho la "P" visible mide ~15 % de la
          contraportada (≈45 mm en 30×30, ≈32 mm en 21×28 y 20×20) y queda a
          más de 300 dpi en todos los formatos. Antes: 24 mm de imagen al 50 %
          de opacidad, una "P" de ~14 mm casi invisible (Jhon, 2026-11-09). */}
      <div style={{ position: 'relative', width: '26cqw', height: '26cqw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Placa solo cuando el logo coral se perdería sobre el fondo (tapa
            coral o rosada); el logo siempre conserva sus colores. */}
        {c.logoPlate && (
          <div style={{ position: 'absolute', width: '19cqw', height: '19cqw', borderRadius: '50%', background: c.logoPlate }} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://assets.pixiaa.com/logo-pixia.png"
          alt="Pixia"
          style={{ position: 'relative', width: '100%', height: 'auto', opacity: c.logoPlate ? 1 : 0.92 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>
      <span style={{
        marginTop: '-2.5cqw',
        fontSize: '2.4cqw',
        letterSpacing: '0.35em',
        paddingLeft: '0.35em',
        color: c.fg,
        opacity: 0.55,
        textTransform: 'uppercase',
        fontFamily: 'system-ui, sans-serif',
      }}>
        PIXIA
      </span>
    </div>
  )
}
