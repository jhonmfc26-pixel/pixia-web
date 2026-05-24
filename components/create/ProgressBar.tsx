'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { useWizard } from './WizardProvider'

const steps = [
  { id: 1, label: 'Historia' },
  { id: 2, label: 'Fotos' },
  { id: 3, label: 'Estilo' },
  { id: 4, label: 'Emoción' },
  { id: 5, label: 'Preview' },
]

export function ProgressBar() {
  const { state } = useWizard()

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {steps.map((step, index) => {
          const isActive = state.step === step.id
          const isCompleted = state.step > step.id

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Círculo */}
              <motion.div
                layout
                initial={false}
                animate={
                  isActive
                    ? {
                        boxShadow: [
                          '0 0 0px rgba(232,85,58,0)',
                          '0 0 16px rgba(232,85,58,0.45)',
                          '0 0 0px rgba(232,85,58,0)',
                        ],
                      }
                    : {}
                }
                transition={{ duration: 0.8, repeat: isActive ? Infinity : 0 }}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 500,
                  background: isActive
                    ? 'var(--brand-coral)'
                    : isCompleted
                    ? 'var(--brand-coral)'
                    : 'var(--bg-elevated)',
                  color: isActive || isCompleted
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                  border: isActive || isCompleted
                    ? 'none'
                    : '1px solid var(--border-medium)',
                  flexShrink: 0,
                }}
              >
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <Check size={12} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="number"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {step.id}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Label */}
              <span style={{
                fontSize: '12px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: isActive ? 500 : 400,
                transition: 'color 0.2s',
              }}>
                {step.label}
              </span>

              {/* Línea conectora */}
              {index < steps.length - 1 && (
                <div style={{
                  width: '24px',
                  height: '1px',
                  background: 'var(--border-subtle)',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
