interface BackCoverPageProps { style?: string }

export default function BackCoverPage({ style: _ }: BackCoverPageProps) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', background: '#111111',
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://assets.pixiaa.com/logo-pixia.png"
        alt="Pixia"
        style={{ width: '26cqw', height: 'auto', opacity: 0.92 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <span style={{
        marginTop: '-2.5cqw',
        fontSize: '2.4cqw',
        letterSpacing: '0.35em',
        paddingLeft: '0.35em',
        color: 'rgba(255,255,255,0.45)',
        textTransform: 'uppercase',
        fontFamily: 'system-ui, sans-serif',
      }}>
        PIXIA
      </span>
    </div>
  )
}
