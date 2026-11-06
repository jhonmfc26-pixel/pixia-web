'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import AlbumMockup from './AlbumMockup'
import { SHOWCASE } from './showcase'

/**
 * "Así se ve un álbum Pixia": spreads reales en vez de fotos de stock
 * sueltas. Reemplaza a ExampleAlbums (tarjetas por ocasión).
 */
export default function Showcase() {
  return (
    <section id="ejemplos" className="bg-[var(--bg-base)] px-4 py-24 sm:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-normal text-[var(--text-primary)] md:text-5xl">
            Así se ve un álbum Pixia
          </h2>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            Cada página la diseña Pixia a partir de tus fotos: qué va grande, qué respira, qué va junto.
          </p>
        </div>

        <div className="mt-20 space-y-24 md:space-y-32">
          {SHOWCASE.map((item, i) => (
            <motion.div key={item.title}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`grid items-center gap-8 md:gap-14 ${i % 2 ? 'lg:grid-cols-[0.6fr_1.4fr]' : 'lg:grid-cols-[1.4fr_0.6fr]'}`}>
              <AlbumMockup spread={item.spread} className={i % 2 ? 'lg:order-2' : ''} />
              <div className={`text-center lg:text-left ${i % 2 ? 'lg:order-1' : ''}`}>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">0{i + 1}</p>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-normal text-[var(--text-primary)] md:text-3xl">{item.title}</h3>
                <p className="mt-3 text-[var(--text-secondary)]">{item.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <Link href="/create" className="inline-flex items-center justify-center rounded-xl border border-[var(--border-medium)] px-8 py-4 text-[15px] text-[var(--text-primary)] transition hover:bg-white/5">
            Crear el mío
          </Link>
        </div>
      </div>
    </section>
  )
}
