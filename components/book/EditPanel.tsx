interface Props {
  photoId: string
  spread: {
    id: string
    act: string
    layout: string
    photos: { id: string }[]
  }
  onClose: () => void
  onEmphasize: (photoId: string) => void
  onReduceImpact: (photoId: string) => void
}

const btnBase: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 8,
  padding: '8px 14px',
  background: 'rgba(255,255,255,0.06)',
  border: 'none',
  borderRadius: 6,
  color: 'rgba(255,255,255,0.7)',
  fontSize: 12,
  textAlign: 'left',
  cursor: 'pointer',
  letterSpacing: '0.03em',
}

export default function EditPanel({
  photoId,
  spread,
  onClose,
  onEmphasize,
  onReduceImpact,
}: Props) {
  const isSingle = spread.photos.length === 1
  const isClimax = spread.act === 'climax'
  const isDevelopment = spread.act === 'desarrollo'
  const isInicio = spread.act === 'inicio'

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: 280,
        height: '100vh',
        background: '#0f0f0f',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 20px',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <p style={{
        margin: '0 0 20px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {spread.act}
      </p>

      {isDevelopment && !isSingle && (
        <button style={btnBase} onClick={() => onEmphasize(photoId)}>
          Hacer protagonista
        </button>
      )}

      {isClimax && isSingle && (
        <button style={btnBase} onClick={() => onReduceImpact(photoId)}>
          Reducir impacto
        </button>
      )}

      {isInicio && (
        <button style={btnBase} onClick={() => onEmphasize(photoId)}>
          Elevar a momento central
        </button>
      )}

      <button
        style={{ ...btnBase, marginTop: 'auto', color: 'rgba(255,255,255,0.3)' }}
        onClick={onClose}
      >
        Cerrar
      </button>
    </div>
  )
}
