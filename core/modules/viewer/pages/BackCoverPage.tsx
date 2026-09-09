interface BackCoverPageProps { style?: string }

export default function BackCoverPage({ style: _ }: BackCoverPageProps) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', background: '#111111',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
    }}>
      {/* URL absoluta a propósito (no /logo-pixia.png): este componente también
          se renderiza vía PrintCoverWrap dentro del pipeline PDF del contenedor
          (Puppeteer + <base href> apuntando a localhost en Cloud Run) — una ruta
          relativa ahí resuelve contra un origen inalcanzable y el logo sale roto.
          Misma URL pública de R2 que usan los correos Resend. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://assets.pixiaa.com/logo-pixia.png"
        alt="Pixia"
        style={{ width: '24mm', height: 'auto', opacity: 0.5 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <span style={{
        fontSize: 12,
        letterSpacing: '0.35em',
        color: 'rgba(255,255,255,0.25)',
        textTransform: 'uppercase',
        fontFamily: 'system-ui, sans-serif',
      }}>
        PIXIA
      </span>
    </div>
  )
}
