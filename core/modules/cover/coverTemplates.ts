import type { OccasionType } from '@/core/contracts/AlbumBlueprint'

export interface CoverTemplate {
  id: string
  occasion: OccasionType
  name: string
  titleFont: string
  titleSize: number
  titleWeight: number
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
    titleSize: 32,
    titleWeight: 400,
    subtitleSize: 13,
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
    titleSize: 40,
    titleWeight: 500,
    subtitleSize: 12,
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
    titleSize: 24,
    titleWeight: 300,
    subtitleSize: 11,
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
    titleSize: 38,
    titleWeight: 600,
    subtitleSize: 13,
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
    titleSize: 28,
    titleWeight: 400,
    subtitleSize: 12,
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
    titleSize: 44,
    titleWeight: 700,
    subtitleSize: 12,
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
    titleSize: 30,
    titleWeight: 400,
    subtitleSize: 14,
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
    titleSize: 48,
    titleWeight: 700,
    subtitleSize: 13,
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
    titleSize: 34,
    titleWeight: 400,
    subtitleSize: 13,
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
    titleSize: 32,
    titleWeight: 400,
    subtitleSize: 13,
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
    titleSize: 36,
    titleWeight: 700,
    subtitleSize: 13,
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
