'use client'
/**
 * Estudio de portada (Jhon, 2026-11-12): módulo propio para diseñar la tapa
 * — plantillas con foto y gráficas (sin foto), texto, tipografía, colores,
 * foto o ilustración — con la tapa completa a la vista (contraportada, lomo
 * y portada) tal como se imprime.
 *
 * Pantalla completa. Celular: la tapa arriba (siempre visible mientras se
 * cambian opciones) y las opciones abajo en pestañas. Computador: tapa a la
 * izquierda, opciones a la derecha.
 *
 * Solo edita un CoverConfig (onChange); quien lo abre decide cuándo guardar.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AlbumFormat, CoverConfig, OccasionType, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import CoverRenderer from './CoverRenderer'
import { galleryTemplates } from './coverTemplates'
import { COVER_FONTS, COVER_PALETTES, TITLE_SCALES, applyTemplate, resolveCover, isHex } from './coverDesign'
import { CoverArtSvg, artForOccasion } from './coverArt'
import { useCoverDesigns } from './useCoverDesigns'
import { countryInTitle, designToCover, normalizeCountry, sortDesigns, type CoverDesign } from '@/lib/coverDesigns'
import PrintCoverWrap, { getCoverWrapDimensionsMm } from '@/core/modules/print/PrintCoverWrap'
import { getBookPrintProfile } from '@/core/modules/print/printProfiles'

type Tab = 'plantillas' | 'texto' | 'letra' | 'color' | 'foto'

interface CoverStudioProps {
  config: CoverConfig
  onChange: (config: CoverConfig) => void
  onClose: () => void
  occasion: OccasionType
  format: AlbumFormat
  /** Fotos del álbum, para elegir la de portada. */
  photos: PhotoAsset[]
  /** Páginas interiores, para el ancho del lomo en la vista de tapa completa. */
  pageCount: number
}

const MM_TO_PX = 96 / 25.4

export default function CoverStudio({ config, onChange, onClose, occasion, format, photos, pageCount }: CoverStudioProps) {
  const [tab, setTab] = useState<Tab>('plantillas')
  const [view, setView] = useState<'portada' | 'completa'>('portada')
  const r = resolveCover(config)
  const [galleryKind, setGalleryKind] = useState<'photo' | 'graphic'>(r.kind)
  const photo = useMemo(() => photos.find(p => p.id === config.photoId) ?? photos[0], [photos, config.photoId])
  const set = (patch: Partial<CoverConfig>) => onChange({ ...config, ...patch })

  // Escape cierra; el fondo no se desplaza mientras el estudio está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'plantillas', label: 'Plantillas' },
    { id: 'texto', label: 'Texto' },
    { id: 'letra', label: 'Letra' },
    { id: 'color', label: 'Color' },
    { id: 'foto', label: r.kind === 'graphic' ? 'Ilustración' : 'Foto' },
  ]

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-[#0d0d0d] text-white" role="dialog" aria-label="Estudio de portada">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3 sm:px-5">
        <button onClick={onClose} className="px-1 py-2 text-sm text-white/55 hover:text-white">← Volver</button>
        <span className="font-[family-name:var(--font-display)] text-[15px] text-white/85">Portada</span>
        <button onClick={onClose} className="rounded-lg bg-[var(--brand-coral)] px-4 py-2 text-sm font-medium text-white">Listo</button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Tapa */}
        <section className="flex shrink-0 flex-col items-center justify-center gap-3 border-b border-white/10 bg-[#141312] px-4 py-3 md:flex-1 md:border-b-0 md:border-r md:py-8">
          <div className="flex rounded-full border border-white/10 bg-black/30 p-0.5 text-xs">
            {(['portada', 'completa'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-full px-3 py-1.5 transition ${view === v ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
                {v === 'portada' ? 'Portada' : 'Tapa completa'}
              </button>
            ))}
          </div>
          {view === 'portada' ? (
            <div className="w-[min(100%,calc(34svh*var(--ar)))] md:w-[min(100%,560px,calc(72svh*var(--ar)))]" style={{ ['--ar' as string]: aspectOf(format) }}>
              <div className="overflow-hidden rounded-[4px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)]">
                <CoverRenderer config={config} photoUrl={photo?.url} photoWidth={photo?.width} photoHeight={photo?.height} format={format} />
              </div>
            </div>
          ) : (
            <FullWrap config={config} photo={photo} format={format} pageCount={pageCount} />
          )}
          <p className="text-center text-[11px] text-white/35">
            {view === 'portada' ? 'Lo que ves es lo que se imprime.' : 'Contraportada · lomo · portada, como sale de la imprenta.'}
          </p>
        </section>

        {/* Opciones */}
        <section className="flex min-h-0 flex-1 flex-col md:w-[420px] md:flex-none">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2" role="tablist">
            {tabs.map(t => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition ${tab === t.id ? 'bg-white/12 text-white ring-1 ring-white/20' : 'text-white/55 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-10">
            {tab === 'plantillas' && (
              <TemplatesPanel config={config} occasion={occasion} format={format} photo={photo}
                kind={galleryKind} setKind={setGalleryKind} onPick={c => onChange(c)} />
            )}
            {tab === 'texto' && <TextPanel config={config} set={set} />}
            {tab === 'letra' && <FontPanel config={config} set={set} />}
            {tab === 'color' && <ColorPanel config={config} set={set} />}
            {tab === 'foto' && (r.kind === 'graphic'
              ? <ArtPanel config={config} occasion={occasion} set={set} />
              : <PhotoPanel photos={photos} selected={photo?.id} onPick={id => set({ photoId: id })} />)}
          </div>
        </section>
      </div>
    </div>
  )
}

const aspectOf = (format: AlbumFormat) => (format === 'a4' ? 3 / 4 : 1)

/** Tapa completa = el mismo componente del PDF, escalado a la pantalla. */
function FullWrap({ config, photo, format, pageCount }: { config: CoverConfig; photo?: PhotoAsset; format: AlbumFormat; pageCount: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const profile = getBookPrintProfile(format)
  const dims = getCoverWrapDimensionsMm(profile, pageCount)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const naturalW = dims.widthMm * MM_TO_PX
  const naturalH = dims.heightMm * MM_TO_PX
  // Que quepa a lo ancho y que en el celular no pase de un tercio del alto.
  const maxH = typeof window !== 'undefined' ? window.innerHeight * (window.innerWidth < 768 ? 0.3 : 0.62) : 400
  const scale = w ? Math.min(w / naturalW, maxH / naturalH) : 0
  return (
    <div ref={ref} className="w-full max-w-[900px]">
      <div className="mx-auto overflow-hidden rounded-[3px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]" style={{ width: naturalW * scale, height: naturalH * scale }}>
        {scale > 0 && (
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: naturalW, height: naturalH }}>
            <PrintCoverWrap cover={config} coverPhoto={photo} title={config.title} pageCount={pageCount} profile={profile} />
          </div>
        )}
      </div>
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-2 block text-[13px] text-white/60">{children}</span>
}

function TemplatesPanel({ config, occasion, format, photo, kind, setKind, onPick }: {
  config: CoverConfig; occasion: OccasionType; format: AlbumFormat; photo?: PhotoAsset
  kind: 'photo' | 'graphic'; setKind: (k: 'photo' | 'graphic') => void; onPick: (c: CoverConfig) => void
}) {
  const list = galleryTemplates(occasion, kind)
  const designs = useCoverDesigns()
  // Viajes: diseños por país. Se sugiere el país que aparece en el título.
  const countries = useMemo(() => [...new Set(designs.filter(d => d.occasion === 'viaje' && d.country).map(d => d.country as string))].sort(), [designs])
  const [country, setCountry] = useState<string | undefined>(undefined)
  const activeCountry = country ?? (occasion === 'viaje' ? countryInTitle(config.title ?? '', countries) : undefined)
  const shown = useMemo(() => {
    const sorted = sortDesigns(designs, occasion, activeCountry)
    if (!activeCountry) return sorted
    const c = normalizeCountry(activeCountry)
    // Con un país elegido: solo viajes de ese país y los que sirven para cualquier destino.
    return sorted.filter(d => d.occasion === 'viaje' && (!d.country || normalizeCountry(d.country) === c))
  }, [designs, occasion, activeCountry])
  const pickDesign = (d: CoverDesign) => onPick({ ...config, ...designToCover(d) })
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-[13px]">
        {(['photo', 'graphic'] as const).map(k => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-lg py-2 transition ${kind === k ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
            {k === 'photo' ? 'Con foto' : 'Sin foto'}
          </button>
        ))}
      </div>
      {kind === 'graphic' && (
        <p className="mb-3 text-[12px] leading-relaxed text-white/45">Color, ilustración y tu título en grande. Después puedes cambiar los colores y el dibujo.</p>
      )}
      {kind === 'graphic' && occasion === 'viaje' && countries.length > 0 && (
        <div className="mb-3">
          <span className="mb-2 block text-[13px] text-white/60">¿A dónde fue el viaje?</span>
          <div className="flex flex-wrap gap-1.5">
            {[undefined, ...countries].map(c => {
              const on = (c ? normalizeCountry(c) : undefined) === (activeCountry ? normalizeCountry(activeCountry) : undefined)
              return (
                <button key={c ?? 'todos'} onClick={() => setCountry(c ?? '')} aria-pressed={on}
                  className={`rounded-full px-3 py-1.5 text-[12px] transition ${on ? 'bg-[var(--brand-coral)] text-white' : 'text-white/65 ring-1 ring-white/15 hover:text-white'}`}>
                  {c ?? 'Todos'}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {kind === 'graphic' && shown.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2.5">
          {shown.map(d => {
            const on = config.designId === d.id
            const preview = { ...config, subtitle: '', date: '', ...designToCover(d) }
            return (
              <button key={d.id} onClick={() => pickDesign(d)} aria-pressed={on}
                className={`rounded-lg p-1 text-center transition ${on ? 'bg-[var(--brand-coral)]/15 ring-2 ring-[var(--brand-coral)]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                <div className="pointer-events-none overflow-hidden rounded-[3px]">
                  <CoverRenderer config={preview} format={format} />
                </div>
                <span className={`mt-1 block truncate text-[11px] ${on ? 'text-[var(--brand-coral)]' : 'text-white/50'}`}>{d.name}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2.5">
        {list.map(t => {
          const on = t.id === config.templateId && !config.designId
          const preview = applyTemplate({ ...config, subtitle: '', date: '' }, t)
          return (
            <button key={t.id} onClick={() => onPick({ ...applyTemplate(config, t), photoId: config.photoId })} aria-pressed={on}
              className={`rounded-lg p-1 text-center transition ${on ? 'bg-[var(--brand-coral)]/15 ring-2 ring-[var(--brand-coral)]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
              <div className="pointer-events-none overflow-hidden rounded-[3px]">
                <CoverRenderer config={preview} photoUrl={photo?.thumbnailUrl || photo?.url} format={format} />
              </div>
              <span className={`mt-1 block truncate text-[11px] ${on ? 'text-[var(--brand-coral)]' : 'text-white/50'}`}>{t.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const POSITIONS = ['top', 'center', 'bottom'] as const
const ALIGNS = ['left', 'center', 'right'] as const
const POS_LABEL = { top: 'Arriba', center: 'En el centro', bottom: 'Abajo' }
const ALIGN_LABEL = { left: 'a la izquierda', center: 'centrado', right: 'a la derecha' }

function TextPanel({ config, set }: { config: CoverConfig; set: (p: Partial<CoverConfig>) => void }) {
  const r = resolveCover(config)
  const input = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[15px] text-white outline-none transition focus:border-[var(--brand-coral)]/60'
  return (
    <div className="space-y-5">
      <label className="block">
        <Label>Título</Label>
        <input className={input} value={config.title} maxLength={40} onChange={e => set({ title: e.target.value })} />
      </label>
      <label className="block">
        <Label>Nombres <span className="text-white/30">· opcional</span></Label>
        <input className={input} value={config.subtitle ?? ''} maxLength={40} placeholder="Ana & Luis" onChange={e => set({ subtitle: e.target.value })} />
      </label>
      <label className="block">
        <Label>Fecha o lugar <span className="text-white/30">· opcional</span></Label>
        <input className={input} value={config.date ?? ''} maxLength={32} placeholder="Cartagena · 2026" onChange={e => set({ date: e.target.value })} />
      </label>
      <div className="flex items-start gap-6">
        <div>
          <Label>Tamaño del título</Label>
          <div className="flex gap-1.5">
            {TITLE_SCALES.map(s => {
              const on = (config.titleScale ?? 1) === s.id
              return (
                <button key={s.label} onClick={() => set({ titleScale: s.id })} aria-pressed={on}
                  className={`h-9 w-10 rounded-lg border text-[13px] transition ${on ? 'border-[var(--brand-coral)] bg-[var(--brand-coral)]/10' : 'border-white/10 text-white/60 hover:border-white/25'}`}>
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <Label>Dónde va el texto</Label>
          <div role="radiogroup" aria-label="Dónde va el texto" className="grid w-[96px] grid-cols-3 grid-rows-3 gap-1 rounded-md border border-white/15 bg-white/[0.04] p-1.5" style={{ aspectRatio: '1' }}>
            {POSITIONS.flatMap(pos => ALIGNS.map(al => {
              const on = r.position === pos && r.align === al
              return (
                <button key={`${pos}-${al}`} role="radio" aria-checked={on} aria-label={`${POS_LABEL[pos]} ${ALIGN_LABEL[al]}`}
                  onClick={() => set({ textPosition: pos, textAlign: al })}
                  className={`flex items-center rounded-[3px] transition ${al === 'left' ? 'justify-start' : al === 'right' ? 'justify-end' : 'justify-center'} ${on ? 'bg-[var(--brand-coral)]/25' : 'hover:bg-white/10'}`}>
                  <span className={`block h-[3px] rounded-full ${on ? 'w-4 bg-[var(--brand-coral)]' : 'w-2 bg-white/30'}`} />
                </button>
              )
            }))}
          </div>
          <span className="mt-1.5 block text-[11px] text-white/45">{POS_LABEL[r.position]} {ALIGN_LABEL[r.align]}</span>
        </div>
      </div>
    </div>
  )
}

function FontPanel({ config, set }: { config: CoverConfig; set: (p: Partial<CoverConfig>) => void }) {
  const r = resolveCover(config)
  const sample = config.title?.trim() || 'Nuestra historia'
  return (
    <div className="grid grid-cols-2 gap-2">
      {COVER_FONTS.map(f => {
        const on = r.font.id === f.id
        return (
          <button key={f.id} onClick={() => set({ fontId: f.id })} aria-pressed={on}
            className={`flex h-[76px] flex-col justify-between overflow-hidden rounded-xl border px-3 py-2 text-left transition ${on ? 'border-[var(--brand-coral)] bg-[var(--brand-coral)]/10' : 'border-white/10 hover:border-white/25'}`}>
            <span className="block truncate text-[22px] leading-tight"
              style={{ fontFamily: `'${f.family}', ${f.fallback}`, fontWeight: f.weight, letterSpacing: f.letterSpacing, textTransform: f.uppercase ? 'uppercase' : 'none' }}>
              {sample}
            </span>
            <span className={`text-[11px] ${on ? 'text-[var(--brand-coral)]' : 'text-white/45'}`}>{f.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Swatch({ bg, fg, on, label, onClick }: { bg: string; fg: string; on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label} title={label}
      className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition ${on ? 'ring-2 ring-[var(--brand-coral)]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
      <span className="flex h-11 w-full items-center justify-center rounded-lg text-[15px] font-semibold" style={{ background: bg, color: fg, fontFamily: 'Georgia, serif' }}>Aa</span>
      <span className="text-[10px] text-white/50">{label}</span>
    </button>
  )
}

/** Gama para «a tu gusto»: tonos de tapa que imprimen bien, de claros a oscuros. */
const COLOR_GRID = [
  '#FFFFFF', '#F7F1E8', '#EFE4D2', '#E4D3B8', '#D9C2A0', '#C9A86A', '#A4673F', '#6E4A33',
  '#F6D9D3', '#EBC9C3', '#E79A8B', '#E8553A', '#C8473A', '#B95F3C', '#8E3B2E', '#5B2F33',
  '#FBE7B5', '#F2C78B', '#DFA33A', '#B9822C', '#DDE5C8', '#B9C4A7', '#7E9470', '#2F4A3A',
  '#D6E6EE', '#9CC3D5', '#4F8AA8', '#24546F', '#CBBCDD', '#8E7BB0', '#35284A', '#16223D',
  '#E6E6E3', '#B8B6B1', '#7D7A75', '#4A4845', '#2E2C2A', '#1B1A19', '#111111', '#000000',
]

/**
 * Selector de color dentro del panel (no el del navegador: su ventana se
 * abría pegada al borde derecho y se veía cortada).
 */
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const commit = (v: string) => {
    const hex = v.startsWith('#') ? v : `#${v}`
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex.toUpperCase())
  }
  return (
    <div className="rounded-xl border border-white/10">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <span className="text-[13px] text-white/70">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase text-white/40">{value}</span>
          <span className="h-7 w-9 rounded-md ring-1 ring-white/20" style={{ background: value }} />
          <span className={`text-[10px] text-white/40 transition ${open ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 p-3">
          <div className="grid grid-cols-8 gap-1.5">
            {COLOR_GRID.map(c => (
              <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} title={c}
                className={`aspect-square rounded-md ring-1 transition ${value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-[var(--brand-coral)]' : 'ring-white/15 hover:ring-white/40'}`}
                style={{ background: c }} />
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2">
            <span className="text-[12px] text-white/50">Código</span>
            <input key={value} defaultValue={value} onChange={e => commit(e.target.value)} maxLength={7} spellCheck={false}
              className="w-28 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[13px] uppercase text-white outline-none focus:border-[var(--brand-coral)]/60" />
          </label>
        </div>
      )}
    </div>
  )
}

const PHOTO_TEXT_COLORS = [
  { label: 'Blanco', fg: '#FFFFFF' },
  { label: 'Negro', fg: '#1A1A1A' },
  { label: 'Crema', fg: '#F4DDA8' },
  { label: 'Coral', fg: '#E8553A' },
]

function ColorPanel({ config, set }: { config: CoverConfig; set: (p: Partial<CoverConfig>) => void }) {
  const r = resolveCover(config)
  if (r.kind === 'graphic') {
    return (
      <div className="space-y-5">
        <div>
          <Label>Combinaciones</Label>
          <div className="grid grid-cols-4 gap-2">
            {COVER_PALETTES.map(p => (
              <Swatch key={p.id} bg={p.bg} fg={p.fg} label={p.name}
                on={r.bg.toLowerCase() === p.bg.toLowerCase() && r.fg.toLowerCase() === p.fg.toLowerCase()}
                onClick={() => set({ bg: p.bg, fg: p.fg, accent: p.accent })} />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>A tu gusto</Label>
          <ColorInput label="Fondo de la tapa" value={r.bg} onChange={v => set({ bg: v })} />
          <ColorInput label="Título y textos" value={r.fg} onChange={v => set({ fg: v })} />
          <ColorInput label="Detalles del dibujo" value={r.accent} onChange={v => set({ accent: v })} />
          <p className="text-[11px] leading-relaxed text-white/40">Si el texto no se lee bien sobre el fondo, lo cambiamos solo a blanco o negro para que la impresión quede legible.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <div>
        <Label>Color del título</Label>
        <div className="grid grid-cols-4 gap-2">
          {PHOTO_TEXT_COLORS.map(c => (
            <Swatch key={c.label} bg="#3a3a3a" fg={c.fg} label={c.label} on={r.fg.toLowerCase() === c.fg.toLowerCase()} onClick={() => set({ fg: c.fg })} />
          ))}
        </div>
        <div className="mt-2"><ColorInput label="Otro color" value={r.fg} onChange={v => set({ fg: v })} /></div>
      </div>
      <div>
        <Label>Color de la tapa <span className="text-white/30">· lomo y contraportada</span></Label>
        <div className="grid grid-cols-4 gap-2">
          {[{ id: 'negro', name: 'Negro', bg: '#111111' }, ...COVER_PALETTES].map(p => (
            <button key={p.id} onClick={() => set({ bg: p.bg })} aria-label={p.name} title={p.name}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition ${r.bg.toLowerCase() === p.bg.toLowerCase() ? 'ring-2 ring-[var(--brand-coral)]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
              <span className="h-8 w-full rounded-md" style={{ background: p.bg }} />
              <span className="text-[10px] text-white/50">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-2"><ColorInput label="Otro color" value={isHex(config.bg) ? config.bg : r.bg} onChange={v => set({ bg: v })} /></div>
      </div>
    </div>
  )
}

function ArtPanel({ config, occasion, set }: { config: CoverConfig; occasion: OccasionType; set: (p: Partial<CoverConfig>) => void }) {
  const r = resolveCover(config)
  return (
    <div>
      <Label>Ilustración</Label>
      <div className="grid grid-cols-3 gap-2.5">
        {artForOccasion(occasion).map(a => {
          const on = !r.artUrl && r.artId === a.id
          return (
            <button key={a.id} onClick={() => set({ artId: a.id, artUrl: undefined, artAspect: undefined, designId: undefined, layout: config.layout === 'full' ? 'poster' : config.layout })} aria-pressed={on}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 transition ${on ? 'ring-2 ring-[var(--brand-coral)]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}
              style={{ background: r.bg }}>
              <CoverArtSvg id={a.id} colors={{ fg: r.fg, accent: r.accent, bg: r.bg }} style={{ width: '100%', aspectRatio: '1' }} />
              <span className="text-[10px]" style={{ color: r.fg, opacity: 0.7 }}>{a.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PhotoPanel({ photos, selected, onPick }: { photos: PhotoAsset[]; selected?: string; onPick: (id: string) => void }) {
  return (
    <div>
      <Label>Foto de portada</Label>
      <div className="grid grid-cols-4 gap-2">
        {photos.map(p => (
          <button key={p.id} onClick={() => onPick(p.id)} aria-pressed={p.id === selected}
            className={`aspect-square overflow-hidden rounded-lg transition ${p.id === selected ? 'ring-2 ring-[var(--brand-coral)]' : 'opacity-75 hover:opacity-100'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbnailUrl || p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}
