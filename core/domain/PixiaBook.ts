import type { LayoutId } from '@/core/modules/album/layouts/registry'
import type { PhotoOrientation, PhotoScore, MeaningRegion } from '@/core/contracts/AlbumBlueprint'

export type ActId = 'inicio' | 'desarrollo' | 'climax' | 'cierre'
export type NarrativeTone = 'emocional' | 'documental' | 'celebracion' | 'sobrio'

export interface PixiaBook {
  identity: { bookId: string; title: string; createdAt: string; version: string }
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
      }[]
      caption?: string
    }[]
  }
  provenance: {
    source: string; photoCount: number
    signalsUsed: string[]; engineVersion: string
  }
}
