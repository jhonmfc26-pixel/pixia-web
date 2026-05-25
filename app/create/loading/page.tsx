'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const messages = [
  { title: 'Analizando tus fotos', sub: 'La IA está viendo cada momento...' },
  { title: 'Detectando emociones', sub: 'Identificando los momentos clave...' },
  { title: 'Construyendo la narrativa', sub: 'Ordenando tu historia en 4 actos...' },
  { title: 'Diseñando cada página', sub: 'Eligiendo el mejor layout para cada foto...' },
  { title: 'Escribiendo los captions', sub: 'Dando voz a tus recuerdos...' },
  { title: 'Casi listo', sub: 'Finalizando tu álbum editorial...' },
]

export default function CreateLoading() {
  const router = useRouter()
  const [msgIndex, setMsgIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  // Rotar mensajes cada 3s en loop
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Avanzar progreso suavemente hasta ~95% mientras espera
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev
        // desaceleración: avanza menos cuanto más cerca del tope
        const step = Math.max(0.3, (95 - prev) * 0.04)
        return Math.min(95, prev + step)
      })
    }, 200)
    return () => clearInterval(interval)
  }, [])

  // Navegación al terminar (disparada desde result/page.tsx vía router)
  // Este componente solo es la pantalla de espera visual — result/page.tsx
  // hace la llamada real y luego navega a /book/[id]
  useEffect(() => {
    if (done) {
      setProgress(100)
      const t = setTimeout(() => router.push('/create/result'), 400)
      return () => clearTimeout(t)
    }
  }, [done, router])

  // Timeout de seguridad: redirige a result después de 30s
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 30000)
    return () => clearTimeout(t)
  }, [])

  const msg = messages[msgIndex]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: '480px', width: '100%' }}>
        {/* Título rotante */}
        <div style={{ position: 'relative', height: '44px', marginBottom: '12px', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.h1
              key={msgIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                inset: 0,
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 400,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {msg.title}
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* Subtítulo rotante */}
        <div style={{ position: 'relative', height: '28px', marginBottom: '40px', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              style={{
                position: 'absolute',
                inset: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
                fontWeight: 300,
              }}
            >
              {msg.sub}
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
            transition={{ ease: 'easeOut', duration: 0.5 }}
          />
        </div>

        {/* Porcentaje */}
        <p style={{
          fontSize: '12px',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.03em',
        }}>
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  )
}
