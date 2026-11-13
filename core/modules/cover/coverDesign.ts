/**
 * Estudio de portada (decisión de Jhon, 2026-11-12): dos tipos de tapa —
 * con foto a sangre y gráfica sin foto (color + ilustración + título
 * grande) — con tipografías, colores y un lomo que sigue el
 * diseño. Este archivo es la fuente única de las opciones (fuentes, paletas)
 * y de `resolveCover`, que combina lo que eligió el cliente con los valores
 * de la plantilla. Lo usan el visor, el editor, el paso 3 y el PDF, así que
 * lo que se ve es lo que se imprime.
 *
 * Compatibilidad: los álbumes anteriores no tienen ninguno de los campos
 * nuevos de CoverConfig y se resuelven exactamente igual que antes (foto,
 * fuente de la plantilla, texto blanco, tapa #111111).
 */
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import { getTemplateById, COVER_TEMPLATES, type CoverTemplate } from './coverTemplates'

// ── Tipografías ──────────────────────────────────────────────────────────

export interface CoverFont {
  id: string
  label: string
  family: string
  /** Respaldo CSS si la fuente no carga. */
  fallback: 'serif' | 'sans-serif' | 'cursive'
  weight: number
  letterSpacing: string
  uppercase: boolean
  /** Ancho medio de una letra en em (para que la palabra más larga quepa). */
  charEm: number
  /** Multiplica el tamaño de la plantilla: las condensadas aguantan más grande. */
  scale: number
}

/**
 * Todas están en el @import de app/globals.css y de
 * core/modules/print/renderPrintHtml.ts (GOOGLE_FONTS_IMPORT): si se agrega
 * una acá, hay que agregarla allá también o el PDF sale con otra letra.
 */
export const COVER_FONTS: CoverFont[] = [
  { id: 'playfair', label: 'Elegante', family: 'Playfair Display', fallback: 'serif', weight: 400, letterSpacing: '0.02em', uppercase: false, charEm: 0.55, scale: 1 },
  { id: 'cormorant', label: 'Clásica', family: 'Cormorant Garamond', fallback: 'serif', weight: 500, letterSpacing: '0.02em', uppercase: false, charEm: 0.47, scale: 1.08 },
  { id: 'dmserif', label: 'Editorial', family: 'DM Serif Display', fallback: 'serif', weight: 400, letterSpacing: '0', uppercase: false, charEm: 0.52, scale: 1 },
  { id: 'fraunces', label: 'Cálida', family: 'Fraunces', fallback: 'serif', weight: 500, letterSpacing: '0', uppercase: false, charEm: 0.56, scale: 1 },
  { id: 'abril', label: 'Revista', family: 'Abril Fatface', fallback: 'serif', weight: 400, letterSpacing: '0.01em', uppercase: false, charEm: 0.6, scale: 0.95 },
  { id: 'bebas', label: 'Póster', family: 'Bebas Neue', fallback: 'sans-serif', weight: 400, letterSpacing: '0.03em', uppercase: true, charEm: 0.42, scale: 1.45 },
  { id: 'anton', label: 'Impacto', family: 'Anton', fallback: 'sans-serif', weight: 400, letterSpacing: '0.01em', uppercase: true, charEm: 0.5, scale: 1.2 },
  { id: 'josefin', label: 'Geométrica', family: 'Josefin Sans', fallback: 'sans-serif', weight: 300, letterSpacing: '0.12em', uppercase: true, charEm: 0.64, scale: 0.85 },
  { id: 'inter', label: 'Moderna', family: 'Inter', fallback: 'sans-serif', weight: 300, letterSpacing: '0.02em', uppercase: false, charEm: 0.56, scale: 1 },
  { id: 'caveat', label: 'A mano', family: 'Caveat', fallback: 'cursive', weight: 600, letterSpacing: '0', uppercase: false, charEm: 0.42, scale: 1.3 },
  { id: 'parisienne', label: 'Caligrafía', family: 'Parisienne', fallback: 'cursive', weight: 400, letterSpacing: '0', uppercase: false, charEm: 0.46, scale: 1.15 },
]

const FONT_BY_ID = new Map(COVER_FONTS.map(f => [f.id, f]))
const FONT_BY_FAMILY = new Map(COVER_FONTS.map(f => [f.family, f]))

export function getFont(id: string | undefined): CoverFont | undefined {
  return id ? FONT_BY_ID.get(id) : undefined
}

/** Fuente de una plantilla vieja (que solo trae titleFont/peso/espaciado). */
function fontOfTemplate(t: CoverTemplate): CoverFont {
  if (t.fontId && FONT_BY_ID.has(t.fontId)) return FONT_BY_ID.get(t.fontId)!
  const base = FONT_BY_FAMILY.get(t.titleFont) ?? FONT_BY_ID.get('playfair')!
  return { ...base, weight: t.titleWeight, letterSpacing: t.letterSpacing }
}

// ── Colores ──────────────────────────────────────────────────────────────

export interface CoverPalette {
  id: string
  name: string
  /** Fondo de la tapa gráfica y color del lomo (la contraportada es siempre la oscura de Pixia). */
  bg: string
  /** Título y textos. */
  fg: string
  /** Detalles de la ilustración. */
  accent: string
}

export const COVER_PALETTES: CoverPalette[] = [
  { id: 'crema', name: 'Crema', bg: '#F3ECE0', fg: '#2A2420', accent: '#C08B5C' },
  { id: 'arena', name: 'Arena', bg: '#E4D3B8', fg: '#3B2F2A', accent: '#A4673F' },
  { id: 'salvia', name: 'Salvia', bg: '#B9C4A7', fg: '#26301F', accent: '#F4EFE3' },
  { id: 'bosque', name: 'Bosque', bg: '#2F4A3A', fg: '#F1E8D2', accent: '#C9A86A' },
  { id: 'mar', name: 'Mar', bg: '#24546F', fg: '#F6EEDF', accent: '#F2B66D' },
  { id: 'noche', name: 'Noche', bg: '#16223D', fg: '#F4DDA8', accent: '#8EA7D6' },
  { id: 'terracota', name: 'Terracota', bg: '#B95F3C', fg: '#FFF4E4', accent: '#F2C78B' },
  { id: 'coral', name: 'Coral', bg: '#E8553A', fg: '#FFF7EF', accent: '#FFD2B8' },
  { id: 'rosa', name: 'Rosa palo', bg: '#EBC9C3', fg: '#5B2F33', accent: '#FFF5F1' },
  { id: 'lavanda', name: 'Lavanda', bg: '#CBBCDD', fg: '#35284A', accent: '#FFF8EE' },
  { id: 'mostaza', name: 'Mostaza', bg: '#DFA33A', fg: '#2B2118', accent: '#FFF1D6' },
  { id: 'carbon', name: 'Carbón', bg: '#1B1A19', fg: '#F2EDE4', accent: '#C9A86A' },
]

const PALETTE_BY_ID = new Map(COVER_PALETTES.map(p => [p.id, p]))
export const getPalette = (id: string | undefined) => (id ? PALETTE_BY_ID.get(id) : undefined)

/** Color del lomo de los álbumes de antes (y de la contraportada, siempre). */
export const LEGACY_CASE_COLOR = '#111111'

const HEX = /^#[0-9a-fA-F]{6}$/
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

/** Luminancia relativa 0..1 (WCAG). */
export function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Texto legible sobre un fondo: el elegido si contrasta, si no blanco o casi negro. */
export function readableOn(bg: string, preferred?: string): string {
  if (preferred && isHex(preferred) && contrastRatio(bg, preferred) >= 3) return preferred
  return luminance(bg) > 0.45 ? '#1F1B18' : '#FFFFFF'
}

// ── Resolución ───────────────────────────────────────────────────────────

/** Campos de diseño de la portada (lo que se guarda además de foto y textos). */
export const DESIGN_KEYS = ['templateId', 'textPosition', 'textAlign', 'textColor', 'kind', 'fontId', 'fg', 'bg', 'accent', 'artId', 'titleScale', 'designId', 'artUrl', 'artAspect', 'layout', 'textX', 'textY', 'titleInArt'] as const
export type DesignKey = typeof DESIGN_KEYS[number]

export type CoverLayout = 'poster' | 'centered' | 'framed' | 'full'

export interface ResolvedCover {
  kind: 'photo' | 'graphic'
  template: CoverTemplate
  font: CoverFont
  /** cqw, ya ajustado para que la palabra más larga quepa. */
  titleSize: number
  subtitleSize: number
  fg: string
  /** Fondo de la tapa gráfica / color del lomo. */
  bg: string
  accent: string
  artId?: string
  /** Arte subido desde el admin (catálogo); tiene prioridad sobre artId. */
  artUrl?: string
  artAspect?: number
  layout: CoverLayout
  /** Texto movido a mano (% de la portada), solo donde el texto va sobre una imagen. */
  textX?: number
  textY?: number
  titleInArt: boolean
  position: CoverConfig['textPosition']
  align: CoverConfig['textAlign']
  overlay: CoverTemplate['overlayStyle']
  showDivider: boolean
}

/** Ancho útil del título: 100cqw menos el padding lateral, con margen. */
const TITLE_WIDTH_CQW = 90 * 0.92
const MIN_TITLE_CQW = 6

export function fitTitle(title: string, maxCqw: number, font: Pick<CoverFont, 'charEm' | 'weight' | 'letterSpacing' | 'uppercase'>): number {
  const longest = Math.max(0, ...title.trim().split(/\s+/).map(w => [...w].length))
  if (longest === 0) return maxCqw
  const bold = font.weight >= 600 ? 0.05 : 0
  const spacing = parseFloat(font.letterSpacing) || 0
  const caps = font.uppercase ? 0.06 : 0
  const charEm = font.charEm + bold + spacing + caps
  const fit = TITLE_WIDTH_CQW / (longest * charEm)
  return Math.max(MIN_TITLE_CQW, Math.min(maxCqw, Math.round(fit * 10) / 10))
}

export const TITLE_SCALES = [
  { id: 0.82, label: 'S' },
  { id: 1, label: 'M' },
  { id: 1.18, label: 'L' },
] as const

export function resolveCover(config: CoverConfig): ResolvedCover {
  const template = getTemplateById(config.templateId) ?? COVER_TEMPLATES[0]
  const kind = config.kind ?? template.kind ?? 'photo'
  const font = getFont(config.fontId) ?? fontOfTemplate(template)
  const palette = getPalette(template.paletteId)
  const scale = config.titleScale && config.titleScale > 0.5 && config.titleScale < 1.6 ? config.titleScale : 1

  let bg: string
  let fg: string
  if (kind === 'graphic') {
    bg = isHex(config.bg) ? config.bg : palette?.bg ?? '#F3ECE0'
    // El color que el cliente (o el admin) eligió se respeta siempre; el
    // estudio avisa si se lee poco. Solo sin elección se garantiza contraste.
    fg = isHex(config.fg) ? config.fg : readableOn(bg, palette?.fg)
  } else {
    bg = isHex(config.bg) ? config.bg : LEGACY_CASE_COLOR
    fg = isHex(config.fg) ? config.fg
      : config.textColor === 'dark' ? '#1a1a1a'
      : '#FFFFFF'
  }
  const accent = isHex(config.accent) ? config.accent : palette?.accent ?? fg

  // El tamaño de la plantilla está pensado para su fuente; con otra fuente se
  // corrige por su escala relativa.
  const baseFont = fontOfTemplate(template)
  const maxTitle = template.titleSize * (font.scale / baseFont.scale) * scale

  return {
    kind,
    template,
    font,
    titleSize: fitTitle(config.title ?? '', maxTitle, font),
    subtitleSize: template.subtitleSize,
    fg, bg, accent,
    artId: kind === 'graphic' && !config.artUrl ? (config.artId ?? template.artId) : undefined,
    artUrl: kind === 'graphic' ? config.artUrl : undefined,
    artAspect: config.artAspect,
    layout: config.layout ?? template.layout ?? 'poster',
    ...(freeText(config, kind) ? { textX: config.textX, textY: config.textY } : {}),
    titleInArt: !!config.titleInArt,
    position: config.textPosition ?? template.defaultPosition,
    align: config.textAlign ?? template.defaultAlign,
    overlay: template.overlayStyle,
    showDivider: template.showDivider,
  }
}

/** Valores de una plantilla al elegirla (lo que el cliente había cambiado de color/fuente se descarta). */
export function applyTemplate(config: CoverConfig, t: CoverTemplate): CoverConfig {
  return {
    ...config,
    templateId: t.id,
    kind: t.kind ?? 'photo',
    textPosition: t.defaultPosition,
    textAlign: t.defaultAlign,
    fontId: undefined,
    fg: undefined,
    bg: undefined,
    accent: undefined,
    artId: undefined,
    titleScale: undefined,
    designId: undefined,
    artUrl: undefined,
    artAspect: undefined,
    layout: undefined,
    textX: undefined,
    textY: undefined,
    titleInArt: undefined,
    textColor: 'auto',
  }
}

/** ¿Este diseño deja mover el texto a mano? Solo cuando el texto va sobre una imagen. */
export function canDragText(config: CoverConfig): boolean {
  const t = getTemplateById(config.templateId)
  const kind = config.kind ?? t?.kind ?? 'photo'
  return kind === 'photo' || (config.layout ?? t?.layout) === 'full'
}

const inRange = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
function freeText(config: CoverConfig, kind: 'photo' | 'graphic'): boolean {
  return inRange(config.textX) && inRange(config.textY) && (kind === 'photo' || config.layout === 'full')
}

// ── Lomo ────────────────────────────────────────────────

/** Color del logo de Pixia (coral). */
const LOGO_COLOR = '#E0405A'

/**
 * Colores del lomo: sigue el
 * fondo elegido. El logo de Pixia NUNCA cambia de color (Jhon, 2026-11-12):
 * si se pierde sobre el fondo (tapa coral o rosada), va sobre una placa
 * redonda clara que lo deja ver con sus colores de siempre.
 */
export function caseColors(cover: CoverConfig | undefined): { bg: string; fg: string; logoPlate?: string } {
  if (!cover) return { bg: LEGACY_CASE_COLOR, fg: '#FFFFFF' }
  const r = resolveCover(cover)
  const bg = r.bg
  const fg = r.kind === 'graphic' ? r.fg : readableOn(bg)
  const logoPlate = contrastRatio(bg, LOGO_COLOR) < 1.8 ? '#FFF7EF' : undefined
  return { bg, fg, logoPlate }
}
