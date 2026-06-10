'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Hero() {
  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '120px 24px 80px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>

      {/* Luz de fondo sutil */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '400px',
        background: 'radial-gradient(ellipse at center, rgba(232,85,58,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Pill label */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '100px',
          border: '1px solid rgba(232,85,58,0.3)',
          background: 'rgba(232,85,58,0.08)',
          marginBottom: '32px',
        }}
      >
        <span style={{
          width: '6px', height: '6px',
          borderRadius: '50%',
          background: 'var(--brand-coral)',
          display: 'inline-block',
        }} />
        <span style={{
          fontSize: '12px',
          color: 'var(--brand-coral)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}>
          Impulsado por IA editorial
        </span>
      </motion.div>

      {/* Título */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px, 6vw, 72px)',
          fontWeight: 500,
          lineHeight: 1.15,
          color: 'var(--text-primary)',
          maxWidth: '760px',
          marginBottom: '24px',
          letterSpacing: '-0.01em',
        }}
      >
        Tus fotos merecen
        <br />
        <em style={{
          fontStyle: 'italic',
          color: 'var(--brand-coral)',
        }}>
          ser un libro.
        </em>
      </motion.h1>

      {/* Subtítulo */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          maxWidth: '480px',
          lineHeight: 1.7,
          marginBottom: '48px',
          fontWeight: 300,
        }}
      >
        Sube tus fotos. Pixia construye
        una narrativa editorial y las convierte
        en un álbum impreso de alta calidad.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Link href="/create" style={{
          padding: '14px 32px',
          borderRadius: '10px',
          background: 'var(--brand-coral)',
          color: 'var(--text-primary)',
          fontSize: '15px',
          fontWeight: 500,
          textDecoration: 'none',
          letterSpacing: '0.01em',
          transition: 'opacity 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.opacity = '0.88'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
        >
          Crear mi álbum
        </Link>

        <a href="#como-funciona" style={{
          padding: '14px 24px',
          borderRadius: '10px',
          border: '1px solid var(--border-medium)',
          color: 'var(--text-secondary)',
          fontSize: '15px',
          fontWeight: 400,
          textDecoration: 'none',
          transition: 'color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.borderColor = 'var(--border-medium)'
        }}
        >
          Cómo funciona
        </a>
      </motion.div>


    </section>
  )
}
