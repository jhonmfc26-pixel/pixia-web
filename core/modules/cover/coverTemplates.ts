import type { OccasionType } from '@/core/contracts/AlbumBlueprint'

export interface CoverTemplate {
  id: string
  occasion: OccasionType
  name: string
  titleFont: string
  /** cqw — % del ancho de la portada (container query en CoverRenderer.tsx), no px. Mismo tamaño relativo en viewer y PDF. */
  titleSize: number
  titleWeight: number
  /** cqw — ver titleSize. */
  subtitleSize: number
  defaultPosition: 'top' | 'center' | 'bottom'
  defaultAlign: 'left' | 'center' | 'right'
  overlayStyle: 'none' | 'gradient-bottom' | 'gradient-full' | 'dark-vignette'
  letterSpacing: string
  showDivider: boolean
}

export const COVER_TEMPLATES: CoverTemplate[] = [
  // BODA
  {
    id: 'wedding-classic',
    occasion: 'boda',
    name: 'Clásica',
    titleFont: 'Playfair Display',
    titleSize: 13.5,
    titleWeight: 400,
    subtitleSize: 4.0,
    defaultPosition: 'bottom',
    defaultAlign: 'center',
    overlayStyle: 'gradient-bottom',
    letterSpacing: '0.08em',
    showDivider: true,
  },
  {
    id: 'wedding-elegant',
    occasion: 'boda',
    name: 'Elegante',
    titleFont: 'Playfair Display',
    titleSize: 17.0,
    titleWeight: 500,
    subtitleSize: 3.8,
    defaultPosition: 'center',
    defaultAlign: 'center',
    overlayStyle: 'dark-vignette',
    letterSpacing: '0.04em',
    showDivider: false,
  },
  {
    id: 'wedding-minimal',
    occasion: 'boda',
    name: 'Minimal',
    titleFont: 'Inter',
    titleSize: 10.5,
    titleWeight: 300,
    subtitleSize: 3.4,
    defaultPosition: 'bottom',
    defaultAlign: 'left',
    overlayStyle: 'gradient-bottom',
    letterSpacing: '0.15em',
    showDivider: false,
  },

  // VIAJE
  {
    id: 'travel-adventure',
    occasion: 'viaje',
    name: 'Aventura',
    titleFont: 'Playfair Display',
    titleSize: 16.0,
    titleWeight: 600,
    subtitleSize: 4.0,
    defaultPosition: 'bottom',
    defaultAlign: 'left',
    overlayStyle: 'gradient-bottom',
    letterSpacing: '0.02em',
    showDivider: false,
  },
  {
    id: 'travel-postcard',
    occasion: 'viaje',
    name: 'Postal',
    titleFont: 'Playfair Display',
    titleSize: 12.0,
    titleWeight: 400,
    subtitleSize: 3.8,
    defaultPosition: 'bottom',
    defaultAlign: 'center',
    overlayStyle: 'none',
    letterSpacing: '0.1em',
    showDivider: true,
  },
  {
    id: 'travel-bold',
    occasion: 'viaje',
    name: 'Destino',
    titleFont: 'Inter',
    titleSize: 18.5,
    titleWeight: 700,
    subtitleSize: 3.8,
    defaultPosition: 'center',
    defaultAlign: 'center',
    overlayStyle: 'gradient-full',
    letterSpacing: '0.05em',
    showDivider: false,
  },

  // BEBÉ
  {
    id: 'baby-tender',
    occasion: 'bebe-mensual',
    name: 'Tierno',
    titleFont: 'Playfair Display',
    titleSize: 12.8,
    titleWeight: 400,
    subtitleSize: 4.3,
    defaultPosition: 'bottom',
    defaultAlign: 'center',
    overlayStyle: 'gradient-bottom',
    letterSpacing: '0.06em',
    showDivider: true,
  },
  {
    id: 'baby-milestone',
    occasion: 'bebe-mensual',
    name: 'Hito',
    titleFont: 'Inter',
    titleSize: 20.0,
    titleWeight: 700,
    subtitleSize: 4.0,
    defaultPosition: 'center',
    defaultAlign: 'center',
    overlayStyle: 'dark-vignette',
    letterSpacing: '0.02em',
    showDivider: false,
  },

  // ANIVERSARIO
  {
    id: 'anniversary-classic',
    occasion: 'aniversario',
    name: 'Clásica',
    titleFont: 'Playfair Display',
    titleSize: 14.5,
    titleWeight: 400,
    subtitleSize: 4.0,
    defaultPosition: 'bottom',
    defaultAlign: 'center',
    overlayStyle: 'gradient-bottom',
    letterSpacing: '0.08em',
    showDivider: true,
  },

  // FAMILIA
  {
    id: 'family-warm',
    occasion: 'familia',
    name: 'Cálida',
    titleFont: 'Playfair Display',
    titleSize: 13.5,
    titleWeight: 400,
    subtitleSize: 4.0,
    defaultPosition: 'bottom',
    defaultAlign: 'center',
    overlayStyle: 'gradient-bottom',
    letterSpacing: '0.06em',
    showDivider: false,
  },

  // MASCOTA
  {
    id: 'pet-playful',
    occasion: 'mascota',
    name: 'Divertida',
    titleFont: 'Inter',
    titleSize: 15.5,
    titleWeight: 700,
    subtitleSize: 4.0,
    defaultPosition: 'bottom',
    defaultAlign: 'center',
    overlayStyle: 'gradient-bottom',
    letterSpacing: '0.03em',
    showDivider: false,
  },
]

export function getTemplatesForOccasion(occasion: OccasionType): CoverTemplate[] {
  return COVER_TEMPLATES.filter(t => t.occasion === occasion)
}

export function getDefaultTemplate(occasion: OccasionType): CoverTemplate {
  return getTemplatesForOccasion(occasion)[0] || COVER_TEMPLATES[0]
}

export function getTemplateById(id: string): CoverTemplate | undefined {
  return COVER_TEMPLATES.find(t => t.id === id)
}

/**
 * Tamaño del título (en cqw) para que la palabra más larga quepa entera en
 * una línea. Sin esto, con títulos de palabras largas ("Cumpleaños papi" en
 * una plantilla de 17cqw) el navegador partía la palabra por la mitad:
 * "Cumpleaño / s papi". Las líneas siguen partiendo entre palabras.
 *
 * Es una estimación por métrica de fuente (ancho medio de letra en em), no
 * una medición: el PDF se arma en el servidor sin poder medir texto. Los
 * factores son conservadores (mejor un poco más chico que partido).
 */
const AVG_CHAR_EM: Record<string, number> = {
  'Playfair Display': 0.55,
  Inter: 0.56,
}
/** Ancho útil del título: 100cqw menos el padding de 5cqw a cada lado, con margen. */
const TITLE_WIDTH_CQW = 90 * 0.92
const MIN_TITLE_CQW = 6

export function fitTitleSize(title: string, template: Pick<CoverTemplate, 'titleSize' | 'titleFont' | 'titleWeight' | 'letterSpacing'>): number {
  const longest = Math.max(0, ...title.trim().split(/\s+/).map(w => [...w].length))
  if (longest === 0) return template.titleSize
  const bold = template.titleWeight >= 600 ? 0.05 : 0
  const spacing = parseFloat(template.letterSpacing) || 0 // em
  const charEm = (AVG_CHAR_EM[template.titleFont] ?? 0.58) + bold + spacing
  const fit = TITLE_WIDTH_CQW / (longest * charEm)
  return Math.max(MIN_TITLE_CQW, Math.min(template.titleSize, Math.round(fit * 10) / 10))
}
