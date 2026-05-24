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

export default function EditPanel({
  photoId,
  spread,
  onClose,
  onEmphasize,
  onReduceImpact
}: Props) {
  const isSingle = spread.layout.includes('single')
  const isClimax = spread.act === 'climax'
  const isDevelopment = spread.act === 'desarrollo'
  const isInicio = spread.act === 'inicio'

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: 320,
        height: '100vh',
        background: '#fff',
        borderLeft: '1px solid #eee',
        padding: 24,
        boxShadow: '-2px 0 10px rgba(0,0,0,0.05)'
      }}
    >
      <h2>Acciones editoriales</h2>
      <p style={{ fontSize: 14, color: '#666' }}>
        Acto: {spread.act}
      </p>

      {isDevelopment && !isSingle && (
        <button
          onClick={() => onEmphasize(photoId)}
          style={{ marginTop: 16, display: 'block' }}
        >
          Hacer protagonista
        </button>
      )}

      {isClimax && isSingle && (
        <button
          onClick={() => onReduceImpact(photoId)}
          style={{ marginTop: 16, display: 'block' }}
        >
          Reducir impacto
        </button>
      )}

      {isInicio && (
        <button
          onClick={() => onEmphasize(photoId)}
          style={{ marginTop: 16, display: 'block' }}
        >
          Elevar a momento central
        </button>
      )}

      <button
        onClick={onClose}
        style={{ marginTop: 24, display: 'block' }}
      >
        Cerrar
      </button>
    </div>
  )
}
