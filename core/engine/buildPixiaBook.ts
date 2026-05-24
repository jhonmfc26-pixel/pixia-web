import { ActId, PixiaBook } from '../domain/PixiaBook'

interface DraftInput {
  title?: string
  photos: { id: string; src: string }[]
  style?: string
  emotion?: string
}

function getActForIndex(index: number, total: number): ActId {
  if (total <= 1) return 'inicio'
  const ratio = index / (total - 1)
  if (ratio < 0.2) return 'inicio'
  if (ratio < 0.6) return 'desarrollo'
  if (ratio < 0.9) return 'climax'
  return 'cierre'
}

export function buildPixiaBook(draft: DraftInput): PixiaBook {
  const pairs: { id: string; src: string }[][] = []
  for (let i = 0; i < draft.photos.length; i += 2) {
    const pair = [draft.photos[i]]
    if (draft.photos[i + 1]) pair.push(draft.photos[i + 1])
    pairs.push(pair)
  }

  const spreads = pairs.map((pair, index) => ({
    id: `spread-${index}`,
    act: getActForIndex(index, pairs.length),
    layout: pair.length === 2 ? 'split-horizontal' : 'full-bleed',
    photos: pair.map((p) => ({ id: p.id, src: p.src })),
  }))

  return {
    identity: {
      bookId: `pb-${Date.now()}`,
      title: draft.title || 'Mi historia Pixia',
      createdAt: new Date().toISOString(),
      version: 'v1'
    },

    editorial: {
      intent: 'memory',
      tone: draft.emotion === 'intense' ? 'emocional' : 'sobrio',
      summary:
        'Un relato construido automáticamente por Pixia a partir de tus momentos más significativos.',
      decisions: [
        {
          id: 'auto-1',
          reason:
            'Las imágenes fueron organizadas para construir una narrativa progresiva.'
        }
      ]
    },

    narrative: {
      acts: [
        {
          id: 'inicio',
          purpose: 'Introducción del momento.',
          spreadIds: spreads.filter(s => s.act === 'inicio').map(s => s.id)
        },
        {
          id: 'desarrollo',
          purpose: 'Construcción narrativa.',
          spreadIds: spreads.filter(s => s.act === 'desarrollo').map(s => s.id)
        },
        {
          id: 'climax',
          purpose: 'Momento más intenso.',
          spreadIds: spreads.filter(s => s.act === 'climax').map(s => s.id)
        },
        {
          id: 'cierre',
          purpose: 'Cierre sereno.',
          spreadIds: spreads.filter(s => s.act === 'cierre').map(s => s.id)
        }
      ]
    },

    physical: {
      format: 'PB-01',
      size: 'A4',
      orientation: 'vertical',
      paper: 'matte',
      cover: 'hard',
      totalSpreads: spreads.length
    },

    content: {
      spreads
    },

    provenance: {
      source: 'wizard',
      photoCount: draft.photos.length,
      signalsUsed: ['auto-layout'],
      engineVersion: '1.0.0'
    }
  }
}
