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
    contentHash?: string
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
    contentHash: photo.contentHash,
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
      bookId: crypto.randomUUID(),
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


// TODO: reactivar solo para análisis offline del taste dataset,
// nunca en el flujo de generación del usuario.
//
// async function _editorialApiCall(draft: AlbumDraft) {
//   const response = await fetch('/api/editorial', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       photoDescriptions: ...,
//       story: draft.story || 'boda',
//       style: draft.style || 'cinematico',
//       emotion: draft.emotion || 'romantica',
//     }),
//   })
//   return response.json()
// }

function titleForOccasion(story?: string): string {
  const s = (story ?? '').toLowerCase()
  if (s.includes('boda') || s.includes('matrimonio') || s.includes('casamiento')) return 'Nuestra boda'
  if (s.includes('viaje') || s.includes('trip') || s.includes('vacacion'))         return 'Nuestro viaje'
  if (s.includes('beb') || s.includes('baby') || s.includes('nacimiento'))         return 'Nuestro bebé'
  if (s.includes('familia') || s.includes('family'))                                return 'Nuestra familia'
  if (s.includes('cumple') || s.includes('birthday'))                               return 'Mi cumpleaños'
  if (s.includes('gradu'))                                                           return 'Mi graduación'
  return 'Mi álbum Pixia'
}

export async function buildPixiaBookWithAI(draft: AlbumDraft): Promise<PixiaBook> {
  const photos = draft.photos

  // Título: el del usuario tiene prioridad; fallback por ocasión
  const title = draft.title || titleForOccasion(draft.story)

  // Orientaciones: usar metadatos de scoring cuando existen
  const orientations = await Promise.all(
    photos.map(async (p) => {
      if (p.orientation === 'landscape' || p.orientation === 'portrait' || p.orientation === 'square') {
        return p.orientation as 'landscape' | 'portrait' | 'square'
      }
      return detectOrientation(p.src)
    })
  )

  // Chunking determinista: cada foto se asigna a un acto según su posición
  // cronológica (índice de foto, no de spread) para reflejar el arco narrativo
  // real del evento.
  function actForPhotoIndex(idx: number): ActId {
    const r = idx / Math.max(1, photos.length - 1)
    if (r < 0.2) return 'inicio'
    if (r < 0.6) return 'desarrollo'
    if (r < 0.9) return 'climax'
    return 'cierre'
  }

  type Spread = PixiaBook['content']['spreads'][number]
  const spreads: Spread[] = []
  let i = 0

  while (i < photos.length) {
    const photo   = photos[i]
    const ori     = orientations[i]
    const next    = photos[i + 1]
    const nextOri = orientations[i + 1]
    const act     = actForPhotoIndex(i)

    if (ori === 'portrait' && next && nextOri === 'portrait') {
      spreads.push({
        id: `spread-${spreads.length}`, act,
        layout: 'side-2',
        photos: [toBookPhoto(photo, ori), toBookPhoto(next, nextOri)],
      })
      i += 2
    } else if (ori === 'portrait' && next && nextOri === 'landscape') {
      spreads.push({
        id: `spread-${spreads.length}`, act,
        layout: 'stack-2',
        photos: [toBookPhoto(photo, ori), toBookPhoto(next, nextOri)],
      })
      i += 2
    } else {
      spreads.push({
        id: `spread-${spreads.length}`, act,
        layout: 'single',
        photos: [toBookPhoto(photo, ori)],
      })
      i += 1
    }
  }

  return {
    identity: {
      bookId: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      version: '2.1-engine',
    },
    editorial: {
      intent: 'memory',
      tone: emotionToTone(draft.emotion),
      summary: title,
      decisions: [{ id: 'engine-1', reason: 'Distribución determinista: actos asignados por posición cronológica de la foto.' }],
    },
    narrative: {
      acts: [
        { id: 'inicio',     purpose: 'Apertura del relato.',    spreadIds: spreads.filter(s => s.act === 'inicio').map(s => s.id) },
        { id: 'desarrollo', purpose: 'Construcción narrativa.', spreadIds: spreads.filter(s => s.act === 'desarrollo').map(s => s.id) },
        { id: 'climax',     purpose: 'Momento culminante.',     spreadIds: spreads.filter(s => s.act === 'climax').map(s => s.id) },
        { id: 'cierre',     purpose: 'Cierre sereno.',          spreadIds: spreads.filter(s => s.act === 'cierre').map(s => s.id) },
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
      source: 'pixia-engine',
      photoCount: photos.length,
      signalsUsed: ['orientation', 'dimensions', 'timestamps', 'scores'],
      engineVersion: '2.1',
    },
  }
}
