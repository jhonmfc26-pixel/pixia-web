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
      id: string; act: ActId; layout: string
      photos: { id: string; src: string }[]
    }[]
  }
  provenance: {
    source: string; photoCount: number
    signalsUsed: string[]; engineVersion: string
  }
}
