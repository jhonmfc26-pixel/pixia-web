// core/editorial/albumBlueprint.ts

import { ActId, NarrativeTone } from '@/core/domain/PixiaBook'

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
    layout: string
    photos: {
      id: string
      src: string
    }[]
  }[]
}
