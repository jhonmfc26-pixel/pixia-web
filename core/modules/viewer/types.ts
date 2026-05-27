import type { PhotoAsset, AlbumStyle, ActId } from '@/core/contracts/AlbumBlueprint'

export interface LayoutProps {
  photos: PhotoAsset[]
  style: AlbumStyle
  side: 'left' | 'right'
  caption?: string
  showCaption: boolean
  act: ActId
}

export const PAGE_BG: Record<AlbumStyle, string> = {
  'con-margen': '#FAFAF8',
  'sin-margen': '#0f0f0f',
}

export const BADGE_COLOR: Record<AlbumStyle, string> = {
  'con-margen': 'rgba(0,0,0,0.2)',
  'sin-margen': 'rgba(255,255,255,0.2)',
}

export const ACT_LABEL: Record<string, string> = {
  inicio: 'inicio',
  desarrollo: 'desarrollo',
  climax: 'clímax',
  cierre: 'cierre',
}
