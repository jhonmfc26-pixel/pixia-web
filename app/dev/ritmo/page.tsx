'use client'
import { useState } from 'react'
import { RITMO_PIXIA_DRAFT, type DraftLayoutSchema, type DensityTier } from '@/core/modules/album/layouts/ritmoPixia.draft'

/**
 * /dev/ritmo — herramienta de revisión visual del catálogo "Ritmo Pixia"
 * (draft, ver ritmoPixia.draft.ts). Renderiza los layouts propuestos con
 * fotos de muestra CURADAS por AR de slot (no al azar) y el crema real de
 * página, para aprobar/ajustar ANTES de tocar el motor de selección o el
 * registry de producción.
 *
 * No importa nada de pageEngine.ts/groupPhotos.ts/layoutFit.ts — deliberado,
 * ver cabecera de ritmoPixia.draft.ts.
 */

type Mode = 'ideal' | 'dificil'

// ── Biblioteca de fotos ancla, por AR ──────────────────────────────────────
// picsum.photos (mismo servicio que ya usaba /dev/layouts) con dimensiones
// elegidas para cubrir todo el rango de AR del catálogo (0.33 a 3.0) — cada
// slot pide la ancla más cercana a SU PROPIO AR (schema.slotArs), no una
// foto genérica al azar. En modo "difícil" se pide deliberadamente la ancla
// más LEJANA — el peor caso real cuando el motor no tiene con qué matchear.
const PAPER = '#F9F6F1'
const GAP_BG = '#F9F6F1'

interface Anchor { seed: string; ar: number; w: number; h: number }

const AR_LIBRARY: Anchor[] = [
  { seed: 'torre-eiffel', ar: 0.33, w: 400, h: 1200 },
  { seed: 'columna', ar: 0.43, w: 425, h: 1000 },
  { seed: 'retrato-alto', ar: 0.50, w: 500, h: 1000 },
  { seed: 'retrato-firme', ar: 0.60, w: 600, h: 1000 },
  { seed: 'retrato-vertical', ar: 0.67, w: 667, h: 1000 },
  { seed: 'retrato-3-4', ar: 0.72, w: 720, h: 1000 },
  { seed: 'retrato-suave', ar: 0.80, w: 800, h: 1000 },
  { seed: 'retrato-relajado', ar: 0.84, w: 840, h: 1000 },
  { seed: 'cuadrada', ar: 1.00, w: 900, h: 900 },
  { seed: 'paisaje-suave', ar: 1.33, w: 1000, h: 750 },
  { seed: 'paisaje', ar: 1.50, w: 1050, h: 700 },
  { seed: 'paisaje-ancho', ar: 2.00, w: 1200, h: 600 },
  { seed: 'panoramica', ar: 2.78, w: 1200, h: 432 },
  { seed: 'panoramica-extrema', ar: 3.00, w: 1200, h: 400 },
]

/** Distancia en escala log — un AR 2x más grande y uno 2x más chico pesan igual. */
function logDist(a: number, b: number): number {
  return Math.abs(Math.log(a / b))
}

function pickAnchor(targetAr: number, mode: Mode): Anchor {
  if (mode === 'ideal') {
    return AR_LIBRARY.reduce((best, cur) => (logDist(cur.ar, targetAr) < logDist(best.ar, targetAr) ? cur : best))
  }
  // Difícil: la ancla más lejana en escala log — la foto que el motor
  // metería si no tuviera nada mejor para ese slot.
  return AR_LIBRARY.reduce((worst, cur) => (logDist(cur.ar, targetAr) > logDist(worst.ar, targetAr) ? cur : worst))
}

function photoUrlForSlot(seedKey: string, slotIndex: number, targetAr: number, mode: Mode): string {
  const a = pickAnchor(targetAr, mode)
  // seed único por layout+slot+modo — mismo par de fotos siempre entre renders,
  // pero ideal y difícil muestran fotos distintas (no solo recortadas distinto).
  return `https://picsum.photos/seed/${a.seed}-${seedKey}-${slotIndex}-${mode}/${a.w}/${a.h}`
}

// ── Tier → color ───────────────────────────────────────────────────────────
const TIER_META: Record<DensityTier, { label: string; dot: string }> = {
  'full-bleed': { label: 'Full-bleed', dot: '#EFE9DE' },
  'equilibrado': { label: 'Equilibrado', dot: '#B5AB9B' },
  'aire': { label: 'Aire', dot: '#6B6250' },
}

// ── Un layout normal (scope: 'page') ────────────────────────────────────────
function LayoutSwatch({ schema, mode }: { schema: DraftLayoutSchema; mode: Mode }) {
  return (
    <div style={{
      width: '100%', aspectRatio: '1 / 1',
      display: 'grid', gap: '2px',
      background: GAP_BG,
      gridTemplateColumns: schema.grid.columns,
      gridTemplateRows: schema.grid.rows,
      gridTemplateAreas: schema.grid.areas,
      border: '1px solid #2A2721',
    }}>
      {schema.slots.map((slot, i) => (
        <div key={slot} style={{ gridArea: slot, position: 'relative', overflow: 'hidden', background: PAPER, minWidth: 0, minHeight: 0 }}>
          <img
            src={photoUrlForSlot(schema.id, i, schema.slotArs[i], mode)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }}
          />
          {schema.heroSlotIndex === i && (
            <span style={{
              position: 'absolute', top: 6, left: 6,
              fontFamily: 'monospace', fontSize: 10,
              background: 'rgba(17,17,17,0.75)', color: '#F0703F',
              width: 18, height: 18, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>H</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Un spread (scope: 'spread') — cruza dos páginas, línea de lomo marcada ──
function SpreadSwatch({ schema, mode }: { schema: DraftLayoutSchema; mode: Mode }) {
  // hero-spread / panorama-air-spread: 1 slot pensado para UNA foto que
  // cruza las 2 páginas — se simula con el mismo recorte a cada lado, como
  // hace hoy HeroSpreadPageView (ver SpreadFaces.tsx) con object-position
  // centrado — a propósito, "como en producción hoy", antes de la regla de
  // gutter de Fase B.
  const isSingleAcross = schema.slots.length === 1
  return (
    <div style={{
      width: '100%', aspectRatio: '2 / 1', position: 'relative',
      display: 'grid', gap: '2px',
      background: GAP_BG,
      gridTemplateColumns: schema.grid.columns,
      gridTemplateRows: schema.grid.rows,
      gridTemplateAreas: schema.grid.areas,
      border: '1px solid #2A2721',
    }}>
      {schema.slots.map((slot, i) => (
        <div key={slot} style={{ gridArea: slot, position: 'relative', overflow: 'hidden', background: PAPER, minWidth: 0, minHeight: 0 }}>
          <img
            src={photoUrlForSlot(schema.id, i, schema.slotArs[i], mode)}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              objectPosition: isSingleAcross ? 'center center' : (i === 0 ? '75% center' : '25% center'),
              display: 'block',
            }}
          />
        </div>
      ))}
      {/* Línea de lomo + zona muerta, siempre al centro físico del spread */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%', width: '8%', transform: 'translateX(-50%)',
        background: 'rgba(166,67,47,0.08)',
        borderLeft: '1px dashed #A6432F', borderRight: '1px dashed #A6432F',
        pointerEvents: 'none', zIndex: 2,
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, transform: 'translateX(-50%)',
        background: 'repeating-linear-gradient(to bottom, #F0703F 0 4px, transparent 4px 8px)',
        pointerEvents: 'none', zIndex: 3,
      }} />
      <span style={{
        position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'monospace', fontSize: 9, color: '#F0703F',
        background: '#111', padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', zIndex: 4,
      }}>
        lomo — zona muerta ±4%
      </span>
    </div>
  )
}

function TierPill({ tier }: { tier: DensityTier }) {
  const m = TIER_META[tier]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
      border: '1px solid #3A352C', borderRadius: 20, padding: '3px 8px', color: '#B5AB9B',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot }} />
      {m.label}
    </span>
  )
}

function LayoutCard({ schema, mode }: { schema: DraftLayoutSchema; mode: Mode }) {
  const isSpread = schema.scope === 'spread'
  return (
    <div style={{ border: `1px solid ${schema.isNew ? '#F0703F' : '#2A2721'}`, borderRadius: 8, overflow: 'hidden', background: '#1B1916' }}>
      <div style={{ padding: 12 }}>
        {isSpread
          ? <SpreadSwatch schema={schema} mode={mode} />
          : <LayoutSwatch schema={schema} mode={mode} />}
      </div>
      <div style={{ padding: '0 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#EFE9DE' }}>{schema.id}</span>
          {schema.isNew && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#F0703F', textTransform: 'uppercase' }}>nuevo</span>}
          {isSpread && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#B5AB9B' }}>↔ gutter</span>}
        </div>
        <p style={{ fontSize: 12.5, color: '#B5AB9B', margin: '0 0 8px', lineHeight: 1.4 }}>
          {schema.role}
          {schema.replacesId && <> — <span style={{ color: '#F0703F' }}>reemplaza {schema.replacesId}</span></>}
        </p>
        <div style={{
          borderTop: '1px dashed #3A352C', paddingTop: 8, marginBottom: 10,
        }}>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#F0703F' }}>
            Momento ideal
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#D8D0C2', lineHeight: 1.4 }}>
            {schema.idealMoment}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'monospace', fontSize: 11, color: '#B5AB9B' }}>
          <TierPill tier={schema.tier} />
          <span>{schema.photoCount} foto{schema.photoCount !== 1 ? 's' : ''} · {schema.areaPercent}%</span>
        </div>
      </div>
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const opt = (value: Mode, label: string, hint: string) => (
    <button
      onClick={() => onChange(value)}
      style={{
        cursor: 'pointer', border: 'none', borderRadius: 6,
        padding: '10px 16px', textAlign: 'left',
        background: mode === value ? '#F0703F' : '#1B1916',
        color: mode === value ? '#111' : '#B5AB9B',
      }}
    >
      <span style={{ display: 'block', fontFamily: 'monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      <span style={{ display: 'block', fontSize: 11, marginTop: 2, opacity: 0.85 }}>{hint}</span>
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {opt('ideal', 'Ideal', 'foto que matchea cada slot')}
      {opt('dificil', 'Difícil', 'peor caso — AR opuesto forzado')}
    </div>
  )
}

export default function RitmoDevPage() {
  const [mode, setMode] = useState<Mode>('ideal')
  const pageLayouts = RITMO_PIXIA_DRAFT.filter(l => l.scope !== 'spread')
  const spreadLayouts = RITMO_PIXIA_DRAFT.filter(l => l.scope === 'spread')
  const counts = [...new Set(pageLayouts.map(l => l.photoCount))].sort((a, b) => a - b)

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#EFE9DE', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ padding: '40px 32px 24px', borderBottom: '1px solid #2A2721', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20 }}>
        <div>
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#F0703F', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
            /dev/ritmo — draft, no producción
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: 32, margin: '0 0 10px' }}>
            Ritmo Pixia — {RITMO_PIXIA_DRAFT.length} layouts
          </h1>
          <p style={{ maxWidth: 640, color: '#B5AB9B', fontSize: 14, margin: 0 }}>
            Fotos curadas por AR de slot (no al azar), crema real de página (#F9F6F1), object-fit: cover como en producción.
            Fuente: <code style={{ background: '#1B1916', padding: '1px 5px', borderRadius: 3 }}>ritmoPixia.draft.ts</code> — no toca el registry ni el motor.
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      <div style={{ padding: '32px 32px 100px' }}>
        {counts.map(count => {
          const layouts = pageLayouts.filter(l => l.photoCount === count)
          return (
            <div key={count} style={{ marginBottom: 56 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid #2A2721' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, color: '#F0703F' }}>{count}</span>
                <span style={{ fontSize: 14, color: '#B5AB9B' }}>foto{count !== 1 ? 's' : ''}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#B5AB9B', textTransform: 'uppercase' }}>
                  {layouts.length} opciones
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                {layouts.map(schema => (
                  <LayoutCard key={schema.id} schema={schema} mode={mode} />
                ))}
              </div>
            </div>
          )
        })}

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid #2A2721' }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: '#F0703F' }}>↔</span>
            <span style={{ fontSize: 14, color: '#B5AB9B' }}>Spreads que cruzan el gutter</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#B5AB9B', textTransform: 'uppercase' }}>
              {spreadLayouts.length} opciones
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
            {spreadLayouts.map(schema => (
              <LayoutCard key={schema.id} schema={schema} mode={mode} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
