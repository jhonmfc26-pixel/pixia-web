'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import AlbumMockup from './AlbumMockup'
import { HERO_SPREAD } from './showcase'

/**
 * Hero: el producto a la vista desde el primer segundo. Antes era solo texto
 * centrado; para un producto físico lo que vende es ver el libro abierto.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg-base)] px-4 pb-20 pt-28 sm:px-8 md:pb-28 md:pt-36">
      {/* Luz de fondo sutil */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[30%] h-[520px] w-[900px] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse at center, rgba(232,85,58,0.10) 0%, transparent 65%)' }} />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* Texto */}
        <div className="text-center lg:text-left">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-coral)]">
            Álbumes impresos · Diseñados por Pixia
          </motion.p>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 font-[family-name:var(--font-display)] text-[44px] font-normal leading-[1.05] tracking-[-0.01em] text-[var(--text-primary)] sm:text-6xl lg:text-[68px]">
            Tus fotos merecen
            <br />
            <em className="text-[var(--brand-coral)]">ser un libro.</em>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-[var(--text-secondary)] lg:mx-0">
            Sube tus fotos y Pixia diseña cada página por ti. Recibe en casa un álbum de tapa dura que vas a querer abrir toda la vida.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/create"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand-coral)] px-8 py-4 text-[15px] font-medium text-white transition hover:brightness-110 sm:w-auto">
              Crear mi álbum
            </Link>
            <a href="#ejemplos"
              className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--border-medium)] px-8 py-4 text-[15px] text-[var(--text-primary)] transition hover:bg-white/5 sm:w-auto">
              Ver ejemplos
            </a>
          </motion.div>

          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--text-tertiary)] lg:justify-start">
            <li>Tapa dura 30 × 30 cm</li>
            <li>Listo en minutos</li>
            <li>Envío a toda Colombia</li>
          </motion.ul>
        </div>

        {/* Álbum abierto */}
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
          <AlbumMockup spread={HERO_SPREAD} tilt />
        </motion.div>
      </div>
    </section>
  )
}
