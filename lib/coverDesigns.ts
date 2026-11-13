/**
 * Catálogo de portadas (tabla cover_designs, ver supabase/portadas.sql): los
 * diseños que Jhon sube desde /admin/portadas — por ocasión y, en viajes, por
 * país — y que el cliente elige en el paso 3 y en el estudio de portada.
 *
 * Al elegir uno, TODO lo necesario para dibujarlo se copia al CoverConfig del
 * álbum (designToCover): si después se oculta o cambia el diseño en el admin,
 * los álbumes que ya lo usan no cambian.
 */
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'

export interface CoverDesign {
  id: string
  created_at: string
  name: string
  occasion: string
  country: string | null
  art_url: string
  art_width: number | null
  art_height: number | null
  layout: 'poster' | 'centered' | 'framed' | 'full'
  bg: string
  fg: string
  accent: string | null
  font_id: string
  text_position: 'top' | 'center' | 'bottom'
  text_align: 'left' | 'center' | 'right'
  active: boolean
  sort: number
  /** El arte trae el título dibujado (ej. «PERÚ»): Pixia no escribe el título encima. */
  title_in_art?: boolean | null
  /** Posición del texto arrastrada en el admin (centro, % de la portada). Solo «tapa completa». */
  text_x?: number | null
  text_y?: number | null
}

export const DESIGN_OCCASIONS: { id: string; label: string }[] = [
  { id: 'viaje', label: 'Viaje' },
  { id: 'boda', label: 'Boda' },
  { id: 'bebe-mensual', label: 'Niños y bebés' },
  { id: 'aniversario', label: 'Aniversario' },
  { id: 'familia', label: 'Familia' },
  { id: 'mascota', label: 'Mascota' },
]

export const DESIGN_LAYOUTS: { id: CoverDesign['layout']; label: string }[] = [
  { id: 'poster', label: 'Póster: título grande y dibujo debajo' },
  { id: 'centered', label: 'Centrada: dibujo al centro y título' },
  { id: 'framed', label: 'Con marco fino' },
  { id: 'full', label: 'Arte de tapa completa (la imagen cubre toda la tapa)' },
]

/** Lo que se copia al álbum al elegir el diseño. */
export function designToCover(d: CoverDesign): Partial<CoverConfig> {
  return {
    templateId: 'catalog',
    kind: 'graphic',
    designId: d.id,
    artUrl: d.art_url,
    artAspect: d.art_width && d.art_height ? d.art_width / d.art_height : undefined,
    layout: d.layout,
    bg: d.bg,
    fg: d.fg,
    accent: d.accent ?? undefined,
    fontId: d.font_id,
    textPosition: d.text_position,
    textAlign: d.text_align,
    textX: d.text_x ?? undefined,
    textY: d.text_y ?? undefined,
    titleInArt: !!d.title_in_art,
    artId: undefined,
    titleScale: undefined,
    textColor: 'auto',
  }
}

/** "Perú" → "peru": para comparar países sin tildes ni mayúsculas. */
export const normalizeCountry = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** País del catálogo que aparece en el título del álbum ("Nuestro viaje a Perú" → "Perú"). */
export function countryInTitle(title: string, countries: string[]): string | undefined {
  const t = ` ${normalizeCountry(title).replace(/[^a-z0-9ñ ]/g, ' ')} `
  return countries.find(c => t.includes(` ${normalizeCountry(c)} `))
}

/**
 * Orden de la galería: primero los de la ocasión del álbum (y en viajes, los
 * del país elegido), después los demás de la ocasión, después el resto.
 */
export function sortDesigns(designs: CoverDesign[], occasion: string, country?: string): CoverDesign[] {
  const c = country ? normalizeCountry(country) : undefined
  const rank = (d: CoverDesign) =>
    (d.occasion === occasion ? 0 : 2) + (c && d.country && normalizeCountry(d.country) === c ? 0 : 1)
  return [...designs].sort((a, b) => rank(a) - rank(b) || a.sort - b.sort)
}

/** Ancho y alto de un PNG, JPEG o WebP leyendo solo la cabecera. */
export function imageSize(buf: ArrayBuffer): { width: number; height: number } | null {
  const b = new Uint8Array(buf)
  const dv = new DataView(buf)
  // PNG: IHDR en el byte 16.
  if (b[0] === 0x89 && b[1] === 0x50) return { width: dv.getUint32(16), height: dv.getUint32(20) }
  // JPEG: buscar el marcador SOF.
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue }
      const m = b[i + 1]
      const len = dv.getUint16(i + 2)
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) }
      }
      i += 2 + len
    }
    return null
  }
  // WebP (VP8X / VP8 / VP8L).
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (chunk === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
    if (chunk === 'VP8 ') return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }
    if (chunk === 'VP8L') {
      const bits = dv.getUint32(21, true)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
  }
  return null
}
