import type { ActId, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import { buildChapters } from '@/core/story/buildChapters'
import { segmentChapter } from './segmentChapter'
import { LAYOUTS } from './layouts/registry'
import type { LayoutId } from './layouts/registry'

export interface PoolPhoto {
  photo: PhotoAsset
  act: ActId
}

export interface PhotoGroup {
  photos: PoolPhoto[]
  isChapterOpener: boolean
  chapterId: string
  /** Layout pre-elegido por segmentChapter. Ausente solo en rutas legacy. */
  layout?: LayoutId
  /** Pérdida ajustada del layout elegido (para telemetría). */
  avgLoss?: number
}

function timestampOf(item: PoolPhoto): number | null {
  const takenAt = item.photo.takenAt
  if (!takenAt) return null
  const time = takenAt instanceof Date ? takenAt.getTime() : new Date(takenAt).getTime()
  return Number.isFinite(time) ? time : null
}

function takenAtIso(item: PoolPhoto): string | null {
  const time = timestampOf(item)
  return time === null ? null : new Date(time).toISOString()
}

function chapterIdOf(id: string): string {
  return id === 'chapter-orphan' ? 'huerfano' : id
}

export function groupPhotos(photos: PoolPhoto[]): PhotoGroup[] {
  const sorted = [...photos].sort((a, b) => {
    const aTime = timestampOf(a)
    const bTime = timestampOf(b)
    if (aTime === null && bTime === null) return 0
    if (aTime === null) return 1
    if (bTime === null) return -1
    return aTime - bTime
  })

  const byId = new Map(sorted.map(item => [item.photo.id, item]))
  const chapters = buildChapters(
    sorted.map(item => ({
      photoId: item.photo.id,
      takenAt: takenAtIso(item),
    }))
  )

  const groups: PhotoGroup[] = []

  for (const chapter of chapters) {
    const chapterId = chapterIdOf(chapter.id)
    const chapterPhotos = chapter.photoIds
      .map(id => byId.get(id))
      .filter((item): item is PoolPhoto => Boolean(item))

    if (chapterPhotos.length === 0) continue

    const segmented = segmentChapter(chapterPhotos, true)

    const capLoss = segmented.length > 0
      ? segmented.reduce((s, g) => s + g.avgLoss, 0) / segmented.length
      : 0

    for (const seg of segmented) {
      groups.push({
        photos: seg.photos,
        isChapterOpener: seg.isChapterOpener,
        chapterId,
        layout: seg.layout,
        avgLoss: seg.avgLoss,
      })
    }

    console.log(
      `[Groups] cap ${chapterId}: ${chapterPhotos.length} fotos → ${segmented.length} grupos` +
      `  pérd:${(capLoss * 100).toFixed(0)}%`
    )
  }

  // Resumen global: distribución de tamaños y contraste full-bleed/aire
  const dist = [1, 2, 3, 4, 5].map(k => groups.filter(g => g.photos.length === k).length)
  const airCount   = groups.filter(g => g.layout && LAYOUTS.find(l => l.id === g.layout)?.hasAir).length
  const bleedCount = groups.length - airCount

  console.log(
    `[Groups] Total: ${chapters.length} cap · ${groups.length} grupos` +
    `  ×1:${dist[0]} ×2:${dist[1]} ×3:${dist[2]} ×4:${dist[3]} ×5:${dist[4]}` +
    `  aire:${airCount} bleed:${bleedCount}`
  )

  return groups
}
