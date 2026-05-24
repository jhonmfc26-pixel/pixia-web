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

function detectOrientation(src: string): Promise<'landscape' | 'portrait' | 'square'> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve('landscape')
      return
    }
    const img = new window.Image()
    img.onload = () => {
      const ratio = img.width / img.height
      if (ratio > 1.2) resolve('landscape')
      else if (ratio < 0.85) resolve('portrait')
      else resolve('square')
    }
    img.onerror = () => resolve('landscape')
    img.src = src
  })
}

export async function buildPixiaBook(draft: DraftInput): Promise<PixiaBook> {
  const photos = draft.photos

  const orientations = await Promise.all(
    photos.map((p) => detectOrientation(p.src))
  )

  type Spread = PixiaBook['content']['spreads'][number]
  const spreads: Spread[] = []
  let i = 0

  while (i < photos.length) {
    const photo = photos[i]
    const orientation = orientations[i]
    const nextPhoto = photos[i + 1]
    const nextOrientation = orientations[i + 1]

    // REGLA 1: Landscape sola o landscape + landscape → full-bleed
    if (orientation === 'landscape' && (!nextPhoto || nextOrientation === 'landscape')) {
      spreads.push({
        id: `spread-${spreads.length}`,
        act: getActForIndex(spreads.length, Math.ceil(photos.length / 2)),
        layout: 'full-bleed',
        photos: [{ id: photo.id, src: photo.src }],
      })
      i += 1
      continue
    }

    // REGLA 2: Dos portraits → split-horizontal
    if (orientation === 'portrait' && nextPhoto && nextOrientation === 'portrait') {
      spreads.push({
        id: `spread-${spreads.length}`,
        act: getActForIndex(spreads.length, Math.ceil(photos.length / 2)),
        layout: 'split-horizontal',
        photos: [
          { id: photo.id, src: photo.src },
          { id: nextPhoto.id, src: nextPhoto.src },
        ],
      })
      i += 2
      continue
    }

    // REGLA 3: Portrait + landscape → editorial-right
    if (orientation === 'portrait' && nextPhoto && nextOrientation === 'landscape') {
      spreads.push({
        id: `spread-${spreads.length}`,
        act: getActForIndex(spreads.length, Math.ceil(photos.length / 2)),
        layout: 'editorial-right',
        photos: [
          { id: photo.id, src: photo.src },
          { id: nextPhoto.id, src: nextPhoto.src },
        ],
      })
      i += 2
      continue
    }

    // REGLA 4: Square o cualquier otro caso → full-bleed
    spreads.push({
      id: `spread-${spreads.length}`,
      act: getActForIndex(spreads.length, Math.ceil(photos.length / 2)),
      layout: 'full-bleed',
      photos: [{ id: photo.id, src: photo.src }],
    })
    i += 1
  }

  return {
    identity: {
      bookId: `pb-${Date.now()}`,
      title: draft.title || 'Mi historia Pixia',
      createdAt: new Date().toISOString(),
      version: 'v1',
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
            'Las imágenes fueron organizadas editorialmente según su orientación.',
        },
      ],
    },

    narrative: {
      acts: [
        {
          id: 'inicio',
          purpose: 'Introducción del momento.',
          spreadIds: spreads.filter((s) => s.act === 'inicio').map((s) => s.id),
        },
        {
          id: 'desarrollo',
          purpose: 'Construcción narrativa.',
          spreadIds: spreads.filter((s) => s.act === 'desarrollo').map((s) => s.id),
        },
        {
          id: 'climax',
          purpose: 'Momento más intenso.',
          spreadIds: spreads.filter((s) => s.act === 'climax').map((s) => s.id),
        },
        {
          id: 'cierre',
          purpose: 'Cierre sereno.',
          spreadIds: spreads.filter((s) => s.act === 'cierre').map((s) => s.id),
        },
      ],
    },

    physical: {
      format: 'PB-01',
      size: 'A4',
      orientation: 'vertical',
      paper: 'matte',
      cover: 'hard',
      totalSpreads: spreads.length,
    },

    content: { spreads },

    provenance: {
      source: 'wizard',
      photoCount: photos.length,
      signalsUsed: ['orientation-layout'],
      engineVersion: '1.1.0',
    },
  }
}
