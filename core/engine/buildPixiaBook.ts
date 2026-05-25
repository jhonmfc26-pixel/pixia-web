import { ActId, NarrativeTone, PixiaBook } from '../domain/PixiaBook'

export interface AlbumDraft {
  title?: string
  photos: { id: string; src: string }[]
  style?: string
  emotion?: string
  story?: string
}

function emotionToTone(emotion?: string): NarrativeTone {
  switch (emotion) {
    case 'romantic':
    case 'intimate':
    case 'nostalgic': return 'emocional'
    case 'epic':
    case 'inspiring': return 'celebracion'
    case 'happy': return 'celebracion'
    default: return 'emocional'
  }
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

export async function buildPixiaBook(draft: AlbumDraft): Promise<PixiaBook> {
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
      tone: emotionToTone(draft.emotion),
      summary: 'Un relato construido automáticamente por Pixia a partir de tus momentos más significativos.',
      decisions: [{ id: 'auto-1', reason: 'Las imágenes fueron organizadas editorialmente según su orientación.' }],
    },
    narrative: {
      acts: [
        { id: 'inicio', purpose: 'Introducción del momento.', spreadIds: spreads.filter((s) => s.act === 'inicio').map((s) => s.id) },
        { id: 'desarrollo', purpose: 'Construcción narrativa.', spreadIds: spreads.filter((s) => s.act === 'desarrollo').map((s) => s.id) },
        { id: 'climax', purpose: 'Momento más intenso.', spreadIds: spreads.filter((s) => s.act === 'climax').map((s) => s.id) },
        { id: 'cierre', purpose: 'Cierre sereno.', spreadIds: spreads.filter((s) => s.act === 'cierre').map((s) => s.id) },
      ],
    },
    physical: { format: 'PB-01', size: 'A4', orientation: 'vertical', paper: 'matte', cover: 'hard', totalSpreads: spreads.length },
    content: { spreads },
    provenance: { source: 'wizard', photoCount: photos.length, signalsUsed: ['orientation-layout'], engineVersion: '1.1.0' },
  }
}

export async function buildPixiaBookWithAI(draft: AlbumDraft): Promise<PixiaBook> {
  let editorial: {
    albumTitle?: string
    globalNarrative?: string
    spreads: { id?: string; act: string; layout: string; photoIds: string[]; caption?: string }[]
  }

  try {
    const response = await fetch('/api/editorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos: draft.photos,
        story: draft.story || 'general',
        style: draft.style || 'cinematico',
        emotion: draft.emotion || 'emocional'
      })
    })

    if (!response.ok) {
      console.warn('AI editorial failed, falling back to mechanical build')
      return buildPixiaBook(draft)
    }

    const data = await response.json()
    editorial = data.editorial
  } catch {
    console.warn('AI editorial error, falling back to mechanical build')
    return buildPixiaBook(draft)
  }

  const photoMap = new Map(draft.photos.map((p) => [p.id, p]))

  const spreads = editorial.spreads
    .map((s, index) => ({
      id: s.id ?? `spread-${index}`,
      act: s.act as ActId,
      layout: s.layout,
      photos: (s.photoIds ?? [])
        .map((id) => photoMap.get(id))
        .filter((p): p is { id: string; src: string } => p !== undefined),
      caption: s.caption,
    }))
    .filter((s) => s.photos.length > 0)

  return {
    identity: {
      bookId: `pb-${Date.now()}`,
      title: editorial.albumTitle || 'Mi historia Pixia',
      createdAt: new Date().toISOString(),
      version: '2.0-ai',
    },
    editorial: {
      intent: editorial.globalNarrative || '',
      tone: emotionToTone(draft.emotion),
      summary: editorial.globalNarrative || '',
      decisions: [],
    },
    narrative: {
      acts: [
        { id: 'inicio', purpose: 'El comienzo de la historia', spreadIds: spreads.filter((s) => s.act === 'inicio').map((s) => s.id) },
        { id: 'desarrollo', purpose: 'El desarrollo de los momentos', spreadIds: spreads.filter((s) => s.act === 'desarrollo').map((s) => s.id) },
        { id: 'climax', purpose: 'Los momentos más emotivos', spreadIds: spreads.filter((s) => s.act === 'climax').map((s) => s.id) },
        { id: 'cierre', purpose: 'El cierre de la historia', spreadIds: spreads.filter((s) => s.act === 'cierre').map((s) => s.id) },
      ],
    },
    physical: { format: 'PB-01', size: 'A4', orientation: 'vertical', paper: 'premium-matte', cover: 'hard', totalSpreads: spreads.length },
    content: { spreads },
    provenance: { source: 'pixia-ai-editorial-v2', photoCount: draft.photos.length, signalsUsed: ['vision', 'emotion', 'style', 'story'], engineVersion: '2.0' },
  }
}
