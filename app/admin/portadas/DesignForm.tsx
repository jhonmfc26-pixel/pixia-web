'use client'
import { useEffect, useMemo, useState } from 'react'
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import CoverRenderer from '@/core/modules/cover/CoverRenderer'
import { COVER_FONTS } from '@/core/modules/cover/coverDesign'
import { DESIGN_LAYOUTS, DESIGN_OCCASIONS } from '@/lib/coverDesigns'

const SAMPLE_TITLE: Record<string, string> = {
  viaje: 'Perú', boda: 'Nuestra boda', 'bebe-mensual': 'Mi primer año', aniversario: '10 años', familia: 'Familia', mascota: 'Luna',
}

/**
 * Formulario para subir un diseño de portada, con la tapa en vivo: así se ve
 * cómo queda el título sobre el arte ANTES de publicarlo.
 */
export default function DesignForm({ minPx }: { minPx: number }) {
  const [file, setFile] = useState<File | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [f, setF] = useState({
    name: '', occasion: 'viaje', country: '', layout: 'poster', bg: '#F06292', fg: '#FFFFFF', accent: '#FFE0B2',
    font_id: 'bebas', text_position: 'top', text_align: 'left', sort: '0', format: '30x30',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const cover: CoverConfig = {
    photoId: '', templateId: 'catalog', kind: 'graphic',
    title: SAMPLE_TITLE[f.occasion] ?? 'Título', subtitle: 'Ana & Luis', date: 'Julio 2026',
    textPosition: f.text_position as CoverConfig['textPosition'], textAlign: f.text_align as CoverConfig['textAlign'], textColor: 'auto',
    artUrl: url || undefined, artAspect: dims ? dims.w / dims.h : undefined,
    layout: f.layout as CoverConfig['layout'], bg: f.bg, fg: f.fg, accent: f.accent, fontId: f.font_id,
  }
  const small = dims && Math.max(dims.w, dims.h) < minPx
  // Calidad de impresión del arte de tapa completa: en 30×30 se recorta un
  // cuadrado del lado menor; en 21×28 (vertical) cubre 21 cm de ancho.
  const dpi = dims && f.layout === 'full'
    ? Math.round(Math.min(Math.min(dims.w, dims.h) / (30 / 2.54), dims.w / (21 / 2.54), dims.h / (28 / 2.54)))
    : null
  const lowDpi = dpi !== null && dpi < 250
  const input = 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[var(--brand-coral)]/60'

  return (
    <form action="/api/admin/cover-designs" method="post" encType="multipart/form-data" className="grid gap-6 md:grid-cols-[1fr_280px]">
      <input type="hidden" name="action" value="create" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 block text-sm">
          <span className="mb-1 block text-[var(--text-secondary)]">Imagen (PNG con fondo transparente, JPG o WebP · mínimo {minPx} px de lado mayor)</span>
          <input name="art" type="file" accept="image/png,image/jpeg,image/webp" required className={input}
            onChange={e => {
              const fl = e.target.files?.[0] ?? null
              setFile(fl); setDims(null)
              // Un JPG no tiene transparencia: casi siempre es arte de tapa completa.
              if (fl && fl.type === 'image/jpeg') setF(p => ({ ...p, layout: 'full' }))
              if (fl) { const im = new Image(); const u = URL.createObjectURL(fl); im.onload = () => { setDims({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(u) }; im.src = u }
            }} />
          {dims && <span className={`mt-1 block text-xs ${small ? 'text-red-300' : lowDpi ? 'text-amber-300' : 'text-[var(--text-tertiary)]'}`}>
            {dims.w}×{dims.h} px{small ? ' — muy pequeña para imprimir' : ''}
            {!small && dpi !== null && ` · se imprime a unos ${dpi} dpi${lowDpi ? ' en 30×30: se verá algo suave. Lo ideal es 3.600×4.800 px.' : ''}`}
          </span>}
        </label>
        <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">Nombre</span>
          <input name="name" required value={f.name} onChange={set('name')} placeholder="Perú — llama" className={input} /></label>
        <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">Ocasión</span>
          <select name="occasion" value={f.occasion} onChange={set('occasion')} className={input}>
            {DESIGN_OCCASIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></label>
        <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">País (solo viajes · vacío = cualquier destino)</span>
          <input name="country" value={f.country} onChange={set('country')} placeholder="Perú" className={input} /></label>
        <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">Composición <span className="text-[var(--text-tertiary)]">· si la imagen ya trae el espacio para el título, «tapa completa»</span></span>
          <select name="layout" value={f.layout} onChange={set('layout')} className={input}>
            {DESIGN_LAYOUTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></label>
        <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">Letra del título</span>
          <select name="font_id" value={f.font_id} onChange={set('font_id')} className={input}>
            {COVER_FONTS.map(o => <option key={o.id} value={o.id}>{o.label} · {o.family}</option>)}
          </select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">Texto</span>
            <select name="text_position" value={f.text_position} onChange={set('text_position')} className={input}>
              <option value="top">Arriba</option><option value="center">Centro</option><option value="bottom">Abajo</option>
            </select></label>
          <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">Alineación</span>
            <select name="text_align" value={f.text_align} onChange={set('text_align')} className={input}>
              <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
            </select></label>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          {([['bg', 'Fondo / lomo'], ['fg', 'Título'], ['accent', 'Detalle']] as const).map(([k, l]) => (
            <label key={k} className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">{l}</span>
              <span className="flex items-center gap-2">
                <input type="color" name={k} value={f[k]} onChange={set(k)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent" />
                <span className="font-mono text-xs text-[var(--text-tertiary)]">{f[k]}</span>
              </span></label>
          ))}
        </div>
        <label className="block text-sm"><span className="mb-1 block text-[var(--text-secondary)]">Orden (menor sale primero)</span>
          <input name="sort" type="number" value={f.sort} onChange={set('sort')} className={input} /></label>
        <div className="flex items-end sm:col-span-2">
          <button className="rounded-lg bg-[var(--brand-coral)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40" disabled={!file || !!small}>
            Publicar diseño
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex gap-1 text-xs">
          {['30x30', 'a4'].map(fm => (
            <button key={fm} type="button" onClick={() => setF(p => ({ ...p, format: fm }))}
              className={`rounded-full px-3 py-1 ${f.format === fm ? 'bg-white text-black' : 'text-[var(--text-secondary)] ring-1 ring-white/10'}`}>
              {fm === 'a4' ? 'Vertical 21×28' : 'Cuadrado'}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded shadow-lg">
          <CoverRenderer config={cover} format={f.format as '30x30' | 'a4'} />
        </div>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">Vista previa con un título de ejemplo. El cliente cambia título, colores y letra.</p>
      </div>
    </form>
  )
}
