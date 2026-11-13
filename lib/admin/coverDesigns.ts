import { supabaseAdmin } from '@/lib/supabase'
import { detectImageType, signedR2Put } from '@/lib/r2Upload'
import { imageSize, type CoverDesign } from '@/lib/coverDesigns'
import { COVER_FONTS, isHex } from '@/core/modules/cover/coverDesign'

/** Lado mayor mínimo del arte: menos que eso se ve pixelado impreso en 30×30. */
export const MIN_ART_PX = 2400
const MAX_ART_BYTES = 20 * 1024 * 1024

export async function listAllDesigns(): Promise<CoverDesign[]> {
  const { data, error } = await supabaseAdmin.from('cover_designs').select('*')
    .order('occasion').order('sort').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as CoverDesign[]
}

const pick = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[], def: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v : def) as T

/** Sube el arte a R2 (carpeta covers/, que la limpieza nunca toca) y crea el diseño. */
export async function createDesign(form: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = form.get('art')
  const name = String(form.get('name') ?? '').trim()
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Falta la imagen del diseño.' }
  if (!name) return { ok: false, error: 'Falta el nombre.' }
  if (file.size > MAX_ART_BYTES) return { ok: false, error: 'La imagen pesa más de 20 MB.' }

  const buf = await file.arrayBuffer()
  const type = detectImageType(buf)
  if (!type) return { ok: false, error: 'Formato no soportado: usa PNG, JPG o WebP.' }
  const size = imageSize(buf)
  if (!size) return { ok: false, error: 'No se pudo leer el tamaño de la imagen.' }
  if (Math.max(size.width, size.height) < MIN_ART_PX) {
    return { ok: false, error: `La imagen mide ${size.width}×${size.height} px: para imprimir bien necesita al menos ${MIN_ART_PX} px de lado mayor.` }
  }

  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  const key = `covers/${crypto.randomUUID()}.${ext}`
  const put = await signedR2Put(process.env.R2_ENDPOINT!, process.env.R2_BUCKET!, key, buf, type,
    process.env.R2_ACCESS_KEY_ID!, process.env.R2_SECRET_ACCESS_KEY!)
  if (!put.ok) return { ok: false, error: `No se pudo subir a R2 (${put.status}).` }

  const color = (k: string, def: string) => { const v = String(form.get(k) ?? ''); return isHex(v) ? v.toUpperCase() : def }
  const country = String(form.get('country') ?? '').trim()
  const row = {
    name,
    occasion: pick(form.get('occasion'), ['viaje', 'boda', 'bebe-mensual', 'aniversario', 'familia', 'mascota'] as const, 'viaje'),
    country: country || null,
    art_url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`,
    art_width: size.width,
    art_height: size.height,
    layout: pick(form.get('layout'), ['poster', 'centered', 'framed', 'full'] as const, 'poster'),
    bg: color('bg', '#F3ECE0'),
    fg: color('fg', '#2A2420'),
    accent: isHex(String(form.get('accent') ?? '')) ? String(form.get('accent')).toUpperCase() : null,
    font_id: pick(form.get('font_id'), COVER_FONTS.map(f => f.id), 'bebas'),
    text_position: pick(form.get('text_position'), ['top', 'center', 'bottom'] as const, 'top'),
    text_align: pick(form.get('text_align'), ['left', 'center', 'right'] as const, 'center'),
    sort: Number.parseInt(String(form.get('sort') ?? '0'), 10) || 0,
  }
  const { error } = await supabaseAdmin.from('cover_designs').insert(row)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Mostrar u ocultar. No se borra nunca: los álbumes que ya lo eligieron
 * apuntan a su imagen en R2.
 */
export async function setDesignActive(id: string, active: boolean): Promise<string | null> {
  const { error } = await supabaseAdmin.from('cover_designs').update({ active }).eq('id', id)
  return error ? error.message : null
}
