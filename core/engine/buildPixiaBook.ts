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

function describePhoto(src: string, index: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const ratio = img.width / img.height
      const orientation =
        ratio > 1.2 ? 'horizontal (landscape)' :
        ratio < 0.85 ? 'vertical (portrait)' :
        'cuadrada'
      const size = img.width > 2000 ? 'alta resolución' : 'resolución estándar'
      resolve(`Foto ${index + 1}: orientación ${orientation}, ${size}, dimensiones ${img.width}x${img.height}px`)
    }
    img.onerror = () => resolve(`Foto ${index + 1}: orientación desconocida`)
    img.src = src
  })
}

export async function buildPixiaBookWithAI(draft: AlbumDraft): Promise<PixiaBook> {
  try {
    const photoDescriptions = await Promise.all(
      draft.photos.map((p, i) => describePhoto(p.src, i))
    )

    const response = await fetch('/api/editorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoDescriptions,
        story: draft.story || 'boda',
        style: draft.style || 'cinematico',
        emotion: draft.emotion || 'romantica',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Pixia] Editorial API error:', errText)
      return buildPixiaBook(draft)
    }

    const { editorial } = await response.json()

    if (!editorial?.spreads) {
      console.error('[Pixia] Editorial sin spreads:', editorial)
      return buildPixiaBook(draft)
    }

    type AISSpread = {
      id?: string
      act: string
      layout: string
      photoIndices: number[]
      caption?: string
    }

    const usedIndices = new Set<number>()

    const spreads = (editorial.spreads as AISSpread[])
      .map((s, index) => {
        const uniqueIndices = (s.photoIndices ?? []).filter((i) => {
          if (usedIndices.has(i)) return false
          usedIndices.add(i)
          return true
        })

        if (uniqueIndices.length === 0) return null

        const photos = uniqueIndices
          .map((i) => draft.photos[i])
          .filter((p): p is { id: string; src: string } => p !== undefined)
          .map((p) => ({ id: p.id, src: p.src }))

        if (photos.length === 0) return null

        const layout = (() => {
          if (s.layout === 'split-horizontal' && photos.length < 2) return 'full-bleed'
          if (s.layout === 'editorial-right' && photos.length < 2) return 'full-bleed'
          return s.layout ?? 'full-bleed'
        })()

        return {
          id: s.id ?? `spread-${index}`,
          act: s.act as ActId,
          layout,
          photos,
          caption: s.caption ?? '',
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    console.log('[Pixia] Fotos únicas usadas:', usedIndices.size, 'de', draft.photos.length, 'disponibles')

    return {
      identity: {
        bookId: `pb-${Date.now()}`,
        title: editorial.albumTitle || 'Mi historia Pixia',
        createdAt: new Date().toISOString(),
        version: '2.0-ai',
      },
      editorial: {
        intent: '',
        tone: emotionToTone(draft.emotion),
        summary: editorial.albumTitle || '',
        decisions: [],
      },
      narrative: {
        acts: [
          { id: 'inicio', purpose: 'El comienzo', spreadIds: spreads.filter((s) => s.act === 'inicio').map((s) => s.id) },
          { id: 'desarrollo', purpose: 'El desarrollo', spreadIds: spreads.filter((s) => s.act === 'desarrollo').map((s) => s.id) },
          { id: 'climax', purpose: 'El clímax', spreadIds: spreads.filter((s) => s.act === 'climax').map((s) => s.id) },
          { id: 'cierre', purpose: 'El cierre', spreadIds: spreads.filter((s) => s.act === 'cierre').map((s) => s.id) },
        ],
      },
      physical: {
        format: 'square',
        size: '30x30cm',
        orientation: 'landscape',
        paper: 'premium-glossy',
        cover: 'hard-cover',
        totalSpreads: spreads.length,
      },
      content: { spreads },
      provenance: {
        source: 'pixia-ai-editorial-v2',
        photoCount: draft.photos.length,
        signalsUsed: ['orientation', 'dimensions', 'emotion', 'style'],
        engineVersion: '2.0',
      },
    }
  } catch {
    console.warn('[Pixia] AI editorial error, falling back to mechanical build')
    return buildPixiaBook(draft)
  }
}
