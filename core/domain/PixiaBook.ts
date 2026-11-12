import type { LayoutId } from '@/core/modules/album/layouts/registry'
import type { PhotoOrientation, PhotoScore, MeaningRegion } from '@/core/contracts/AlbumBlueprint'

export type ActId = 'inicio' | 'desarrollo' | 'climax' | 'cierre'
export type NarrativeTone = 'emocional' | 'documental' | 'celebracion' | 'sobrio'

export interface PixiaBook {
  identity: { bookId: string; title: string; createdAt: string; version: string }
  /** Ocasión del álbum (boda, viaje, aniversario, familia...) — elige la plantilla de portada. */
  occasion?: string
  /** Formato físico como lo guarda el blueprint: '30x30' | '20x20' | 'a4' (vertical). Sin valor = 30x30. normalizeBook lo lee como raw.format. */
  format?: string
  /** Lo que el cliente escribió en el paso "Tu portada". normalizeBook lo lee como raw.cover. */
  cover?: {
    title: string; subtitle?: string; date?: string; photoId?: string
    templateId?: string
    textPosition?: 'top' | 'center' | 'bottom'
    textAlign?: 'left' | 'center' | 'right'
    textColor?: 'auto' | 'light' | 'dark'
    kind?: 'photo' | 'graphic'
    fontId?: string
    fg?: string
    bg?: string
    accent?: string
    artId?: string
    titleScale?: number
  }
  editorial: {
    intent: string; tone: NarrativeTone; summary: string
    decisions: { id: string; reason: string }[]
  }
  narrative: {
    acts: { id: ActId; purpose: string; spreadIds: string[] }[]
  }
  physical: {
    format: string; size: string; orientation: string
    paper: string; cover: string; totalSpreads: number
  }
  content: {
    spreads: {
      id: string; act: ActId; layout: LayoutId
      photos: {
        id: string
        src: string
        url?: string
        thumbnailUrl?: string
        r2Key?: string
        width?: number
        height?: number
        orientation?: PhotoOrientation
        score?: Partial<PhotoScore>
        takenAt?: string | null
        gps?: { lat: number; lng: number }
        originalName?: string
        meaningRegions?: MeaningRegion[]
        contentHash?: string
      }[]
      caption?: string
    }[]
  }
  provenance: {
    source: string; photoCount: number
    signalsUsed: string[]; engineVersion: string
  }
}
