interface BackCoverPageProps { style?: string }

export default function BackCoverPage({ style: _ }: BackCoverPageProps) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', background: '#111111',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-pixia.png"
        alt="Pixia"
        width={32}
        height={32}
        style={{ opacity: 0.5 }}
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
