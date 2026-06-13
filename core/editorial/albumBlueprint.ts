// core/editorial/albumBlueprint.ts

import { ActId, NarrativeTone } from '@/core/domain/PixiaBook'
import type { LayoutId } from '@/core/modules/album/layouts/registry'

export interface AlbumBlueprint {
  albumId: string

  narrative: {
    tone: NarrativeTone
    acts: {
      id: ActId
      description: string
    }[]
  }

  style: {
    name: string
    colorScheme: 'light' | 'dark'
    typography: 'serif' | 'sans'
  }

  decisions: {
    reason: string
  }[]

  spreads: {
    id: string
    act: ActId
    layout: LayoutId
    photos: {
      id: string
      src: string
    }[]
  }[]
}
