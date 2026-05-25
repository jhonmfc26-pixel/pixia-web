'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const steps = [
  { text: 'Seleccionando tus momentos clave…', target: 25 },
  { text: 'Organizando la narrativa visual…', target: 50 },
  { text: 'Aplicando el criterio editorial…', target: 75 },
  { text: 'Tu historia está tomando forma…', target: 100 },
]

export default function CreateLoading() {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setIndex((prev) => Math.min(prev + 1, steps.length - 1))
    }, 1000)
    return () => clearInterval(stepTimer)
  }, [])

  useEffect(() => {
    const target = steps[index].target
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= target) return prev
        return prev + 1
      })
    }, 30)
    return () => clearInterval(progressTimer)
  }, [index])

  useEffect(() => {
    if (progress >= 100) {
      const timeout = setTimeout(() => {
        router.push('/create/result')
      }, 600)
      return () => clearTimeout(timeout)
    }
  }, [progress, router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: '480px', width: '100%' }}>
        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 400,
            color: 'var(--text-primary)',
            marginBottom: '24px',
            letterSpacing: '-0.01em',
          }}
        >
          Creando tu historia
        </motion.h1>

        {/* Texto de estado */}
        <div style={{ position: 'relative', height: '40px', marginBottom: '32px', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                inset: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
                fontWeight: 300,
              }}
            >
              {steps[index].text}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Barra de progreso */}
        <div style={{
          width: '100%',
          height: '2px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '1px',
          overflow: 'hidden',
          marginBottom: '12px',
        }}>
          <motion.div
            style={{ height: '100%', background: 'var(--brand-coral)', borderRadius: '1px' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>

        {/* Porcentaje */}
        <p style={{
          fontSize: '12px',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.03em',
        }}>
          {progress}%
        </p>
      </div>
    </div>
  )
}
