'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      padding: '0 32px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'background 0.3s ease, border-color 0.3s ease',
      background: scrolled ? 'rgba(13,13,13,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled
        ? '1px solid rgba(255,255,255,0.06)'
        : '1px solid transparent',
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none'
      }}>
        <Image
          src="/logo-pixia.png"
          alt="Pixia"
          width={28}
          height={28}
          style={{ objectFit: 'contain' }}
        />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '0.02em',
        }}>
          Pixia
        </span>
      </Link>

      {/* Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '32px'
      }}>
        {[
          { label: 'Cómo funciona', href: '#como-funciona' },
          { label: 'Ejemplos', href: '#ejemplos' },
          { label: 'Precios', href: '#precios' },
        ].map(({ label, href }) => (
          <a key={label} href={href} style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            transition: 'color 0.2s',
            fontWeight: 400,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* CTA */}
      <Link href="/create" style={{
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--text-primary)',
        textDecoration: 'none',
        padding: '9px 20px',
        borderRadius: '8px',
        background: 'var(--brand-coral)',
        transition: 'opacity 0.2s',
        letterSpacing: '0.01em',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Crear álbum
      </Link>
    </header>
  )
}
