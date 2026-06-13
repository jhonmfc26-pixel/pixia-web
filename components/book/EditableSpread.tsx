'use client'

import { motion } from 'framer-motion'
import { PixiaBook, ActId } from '@/core/domain/PixiaBook'

const ACT_COLORS: Record<ActId, string> = {
  inicio:     '#9ca3af',
  desarrollo: '#f59e0b',
  climax:     '#ec4899',
  cierre:     '#a78bfa',
}

interface Props {
  spread: PixiaBook['content']['spreads'][number]
  onSelectPhoto: (photoId: string) => void
}

export default function EditableSpread({ spread, onSelectPhoto }: Props) {
  const isSingle = spread.layout === 'single'
  const actColor = ACT_COLORS[spread.act]

  return (
    <motion.div
      layout
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{
        marginBottom: 40,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <motion.div
        layout
        style={{
          width: 600,
          aspectRatio: '4 / 3',
          background: '#f8f8f8',
          padding: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: isSingle ? 'center' : 'space-between',
          border: '1px solid #eee',
          position: 'relative',
        }}
      >
        <span style={{
          position: 'absolute', top: 8, left: 8,
          background: actColor, color: '#fff', fontSize: 9,
          padding: '2px 8px', borderRadius: 12, fontWeight: 700,
          letterSpacing: 1.5, textTransform: 'uppercase',
          zIndex: 1,
        }}>
          {spread.act}
        </span>

        {spread.photos.map((photo) => (
          <motion.div
            key={photo.id}
            layout
            onClick={() => onSelectPhoto(photo.id)}
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 200 }}
            style={{
              cursor: 'pointer',
              flex: 1,
              position: 'relative',
              height: '100%',
              overflow: 'hidden',
              borderRadius: 6,
            }}
          >
            <img
              src={photo.src}
              alt={photo.id}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}
