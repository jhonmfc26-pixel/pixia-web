import { ActId, NarrativeTone, PixiaBook } from '../domain/PixiaBook'
import type { PhotoOrientation, MeaningRegion } from '../contracts/AlbumBlueprint'

export interface AlbumDraft {
  title?: string
  photos: {
    id: string
    src: string
    url?: string
    thumbnailUrl?: string
    r2Key?: string
    width?: number
    height?: number
    orientation?: string
    score?: PixiaBook['content']['spreads'][number]['photos'][number]['score']
    takenAt?: string | null
    gps?: { lat: number; lng: number }
    originalName?: string
    meaningRegions?: MeaningRegion[]
  }[]
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

function layoutForPhotoCount(count: number): PixiaBook['content']['spreads'][number]['layout'] {
  if (count >= 5) return 'mosaic-5'
  if (count === 4) return 'grid-4'
  if (count === 3) return 'grid-3'
  if (count === 2) return 'side-2'
  return 'single'
}

function toBookPhoto(
  photo: AlbumDraft['photos'][number],
  orientation: PhotoOrientation,
): PixiaBook['content']['spreads'][number]['photos'][number] {
  return {
    id: photo.id,
    src: photo.src,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    r2Key: photo.r2Key,
    width: photo.width,
    height: photo.height,
    orientation,
    score: photo.score,
    takenAt: photo.takenAt ?? null,
    gps: photo.gps,
    originalName: photo.originalName,
    meaningRegions: photo.meaningRegions,
  }
}

export async function buildPixiaBook(draft: AlbumDraft): Promise<PixiaBook> {
  const photos = draft.photos

  // Usar p.orientation del scoring si existe, fallback a detectOrientation
  const orientations = await Promise.all(
    photos.map(async (p) => {
      if (p.orientation === 'landscape' || p.orientation === 'portrait' || p.orientation === 'square') {
        return p.orientation
      }
      return detectOrientation(p.src)
    })
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
        layout: 'single',
        photos: [toBookPhoto(photo, orientation)],
      })
      i += 1
      continue
    }

    if (orientation === 'portrait' && nextPhoto && nextOrientation === 'portrait') {
      spreads.push({
        id: `spread-${spreads.length}`,
        act: getActForIndex(spreads.length, Math.ceil(photos.length / 2)),
        layout: 'side-2',
        photos: [
          toBookPhoto(photo, orientation),
          toBookPhoto(nextPhoto, nextOrientation),
        ],
      })
      i += 2
      continue
    }

    if (orientation === 'portrait' && nextPhoto && nextOrientation === 'landscape') {
      spreads.push({
        id: `spread-${spreads.length}`,
        act: getActForIndex(spreads.length, Math.ceil(photos.length / 2)),
        layout: 'stack-2',
        photos: [
          toBookPhoto(photo, orientation),
          toBookPhoto(nextPhoto, nextOrientation),
        ],
      })
      i += 2
      continue
    }

    spreads.push({
      id: `spread-${spreads.length}`,
      act: getActForIndex(spreads.length, Math.ceil(photos.length / 2)),
      layout: 'single',
      photos: [toBookPhoto(photo, orientation)],
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
      draft.photos.map((p, i) => {
        if (p.orientation) {
          const rec = p.score?.recommendation ?? 'supporting'
          const time = p.takenAt
            ? new Date(p.takenAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            : null
          const timeCtx = time ? ` — tomada a las ${time}` : ''
          const scoreCtx = rec === 'hero'
            ? ' — FOTO PROTAGONISTA (alta calidad)'
            : rec === 'discard' ? ' — foto de calidad baja' : ''
          return `Foto ${i + 1}: orientación ${p.orientation}${timeCtx}${scoreCtx}`
        }
        return describePhoto(p.src, i)
      })
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
      photoIndices: number[]
      caption?: string
    }

    function sanitizeIndices(indices: number[], max: number, used: Set<number>): number[] {
      return indices.filter(i => {
        if (!Number.isInteger(i) || i < 0 || i >= max) {
          console.warn('[Pixia] Índice inválido propuesto por IA, descartado:', i)
          return false
        }
        if (used.has(i)) return false
        return true
      })
    }

    const usedIndices = new Set<number>()

    const spreads = (editorial.spreads as AISSpread[])
      .map((s, index) => {
        const validIndices = sanitizeIndices(s.photoIndices ?? [], draft.photos.length, usedIndices)
        validIndices.forEach(i => usedIndices.add(i))

        if (validIndices.length === 0) return null

        const photos = validIndices
          .map((i) => draft.photos[i])
          .map((p) => toBookPhoto(
            p,
            p.orientation === 'landscape' || p.orientation === 'portrait' || p.orientation === 'square'
              ? p.orientation
              : 'landscape'
          ))

        return {
          id: s.id ?? `spread-${index}`,
          act: s.act as ActId,
          layout: layoutForPhotoCount(photos.length),
          photos,
          caption: s.caption ?? '',
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    console.log('[Pixia] Fotos únicas usadas:', usedIndices.size, 'de', draft.photos.length, 'disponibles')

    // Recuperar fotos omitidas por la IA (no debería pasar pero pasa)
    const unusedPhotos = draft.photos.filter((_, i) => !usedIndices.has(i))

    if (unusedPhotos.length > 0) {
      console.warn('[Pixia] IA omitió', unusedPhotos.length, 'fotos — recuperándolas como spreads extra')

      let i = 0
      while (i < unusedPhotos.length) {
        const photo = unusedPhotos[i]
        const next = unusedPhotos[i + 1]
        const orientation = photo.orientation || 'landscape'
        const nextOri = next?.orientation || 'landscape'

        let layout: PixiaBook['content']['spreads'][number]['layout'] = 'single'
        let photosInSpread = [photo]

        if (next && orientation === 'portrait' && nextOri === 'portrait') {
          layout = 'side-2'
          photosInSpread = [photo, next]
          i += 2
        } else if (next && orientation === 'portrait' && nextOri === 'landscape') {
          layout = 'stack-2'
          photosInSpread = [photo, next]
          i += 2
        } else {
          i += 1
        }

        spreads.push({
          id: `spread-extra-${spreads.length}`,
          act: 'cierre' as ActId,
          layout,
          photos: photosInSpread.map(p => toBookPhoto(
            p,
            p.orientation === 'landscape' || p.orientation === 'portrait' || p.orientation === 'square'
              ? p.orientation
              : 'landscape'
          )),
          caption: '',
        })
      }

      console.log('[Pixia] Total spreads finales:', spreads.length, '— fotos garantizadas:', draft.photos.length)
    }

    // Invariante: detectar IDs duplicados en spreads finales
    const allIds = spreads.flatMap(s => s.photos.map(p => p.id))
    const dupIds = allIds.filter((id, i) => allIds.indexOf(id) !== i)
    if (dupIds.length > 0) {
      console.error('[Pixia] ⚠️ IDs DUPLICADOS en spreads:', [...new Set(dupIds)])
    }

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
