'use client'

import { useState } from 'react'
import ContinueButton from '@/components/create/ContinueButton'
import { useWizard } from '@/components/create/WizardProvider'

const emotions = [
  {
    id: 'happy',
    ordinal: '01',
    title: 'Alegre',
    desc: 'Luminosa, ligera, llena de sonrisas',
  },
  {
    id: 'romantic',
    ordinal: '02',
    title: 'Romántica',
    desc: 'Suave, amorosa, íntima',
  },
  {
    id: 'nostalgic',
    ordinal: '03',
    title: 'Nostálgica',
    desc: 'Recuerdos que tocan el corazón',
  },
  {
    id: 'epic',
    ordinal: '04',
    title: 'Épica',
    desc: 'Como el tráiler de una gran película',
  },
  {
    id: 'intimate',
    ordinal: '05',
    title: 'Íntima',
    desc: 'Cercana, real, profundamente humana',
  },
  {
    id: 'inspiring',
    ordinal: '06',
    title: 'Inspiradora',
    desc: 'Motivadora, llena de esperanza',
  },
]

export default function Step4Emotion() {
  const { state, dispatch } = useWizard()
  const [selected, setSelected] = useState<string | null>(state.emotion ?? null)

  const handleSelect = (id: string) => {
    setSelected(id)
    dispatch({ type: 'SET_EMOTION', payload: id as any })
  }

  return (
    <div style={{ width: '100%', paddingBottom: '72px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          marginBottom: '10px',
        }}>
          ¿Qué emoción quieres transmitir?
        </h1>
        <p style={{
          fontSize: '16px',
          color: 'var(--text-secondary)',
          fontWeight: 300,
          lineHeight: 1.6,
        }}>
          Esto define el tono narrativo de tu álbum.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '48px',
      }}>
        {emotions.map((emotion) => {
          const isSelected = selected === emotion.id
          return (
            <div
              key={emotion.id}
              onClick={() => handleSelect(emotion.id)}
              style={{
                background: isSelected ? 'rgba(232, 85, 58, 0.06)' : 'var(--bg-surface)',
                border: isSelected
                  ? '1px solid var(--brand-coral)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '28px 24px',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 20px rgba(232, 85, 58, 0.15)' : 'none',
                transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-medium)'
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-subtle)'
              }}
            >
              <span style={{
                display: 'block',
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.15em',
                fontWeight: 400,
                marginBottom: '12px',
              }}>
                {emotion.ordinal}
              </span>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '6px',
                letterSpacing: '-0.01em',
              }}>
                {emotion.title}
              </h3>
              <p style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                fontWeight: 300,
                lineHeight: 1.55,
              }}>
                {emotion.desc}
              </p>
            </div>
          )
        })}
      </div>

      <ContinueButton disabled={!selected} />
    </div>
  )
}
