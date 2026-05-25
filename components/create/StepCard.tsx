'use client'

import { motion } from 'framer-motion'

type StepCardProps = {
  title: string
  image: string
  filterClass: string
  selected?: boolean
  onClick?: () => void
}

export default function StepCard({ title, image, filterClass, selected = false, onClick }: StepCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: '12px',
        overflow: 'hidden',
        border: selected
          ? '2px solid var(--brand-coral)'
          : '1px solid var(--border-subtle)',
        boxShadow: selected
          ? '0 0 24px rgba(232, 85, 58, 0.3)'
          : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Imagen */}
      <div style={{ position: 'relative', height: '176px', width: '100%', overflow: 'hidden' }}>
        <img
          src={image}
          alt={title}
          className={`w-full h-full object-cover transition-all duration-500 ${filterClass}`}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      </div>

      {/* Título */}
      <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', textAlign: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 500, fontSize: '16px' }}>
          {title}
        </span>
      </div>
    </motion.div>
  )
}
