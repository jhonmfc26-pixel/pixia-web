import type { ActId, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import { buildChapters } from '@/core/story/buildChapters'

const TEN_MINUTES_MS = 10 * 60 * 1000

export interface PoolPhoto {
  photo: PhotoAsset
  act: ActId
}

export interface PhotoGroup {
  photos: PoolPhoto[]
  isChapterOpener: boolean
  chapterId: string
}

function scoreOf(item: PoolPhoto): number {
  return item.photo.score?.finalScore ?? 0
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

function isBurstStep(current: PoolPhoto, next: PoolPhoto): boolean {
  const currentTime = timestampOf(current)
  const nextTime = timestampOf(next)
  if (currentTime === null || nextTime === null) return false
  return nextTime - currentTime < TEN_MINUTES_MS
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
  let burstCount = 0
  let pairCount = 0
  let soloCount = 0
  let openerCount = 0

  for (const chapter of chapters) {
    const chapterId = chapterIdOf(chapter.id)
    const chapterPhotos = chapter.photoIds
      .map(id => byId.get(id))
      .filter((item): item is PoolPhoto => Boolean(item))

    if (chapterPhotos.length === 0) continue

    const opener = [...chapterPhotos].sort((a, b) => scoreOf(b) - scoreOf(a))[0]
    groups.push({
      photos: [opener],
      isChapterOpener: true,
      chapterId,
    })
    openerCount += 1

    const rest = chapterPhotos.filter(item => item.photo.id !== opener.photo.id)
    let i = 0

    while (i < rest.length) {
      const burst: PoolPhoto[] = [rest[i]]
      while (
        i + burst.length < rest.length &&
        isBurstStep(rest[i + burst.length - 1], rest[i + burst.length])
      ) {
        burst.push(rest[i + burst.length])
      }

      if (burst.length >= 3) {
        const size = Math.min(5, burst.length)
        groups.push({
          photos: burst.slice(0, size),
          isChapterOpener: false,
          chapterId,
        })
        burstCount += 1
        i += size
        continue
      }

      if (i + 1 < rest.length) {
        const curr = rest[i]
        const nextItem = rest[i + 1]
        const currOri = curr.photo.orientation || 'landscape'
        const nextOri = nextItem.photo.orientation || 'landscape'

        if (currOri === nextOri) {
          // Par homogéneo — el layout de 2 slots siempre encajará
          groups.push({ photos: [curr, nextItem], isChapterOpener: false, chapterId })
          pairCount += 1
          i += 2
          continue
        }

        // Orientaciones mixtas: intentar saltar 1 posición para lograr par homogéneo
        // Máximo 1 salto para no romper la cronología percibida
        const skipItem = i + 2 < rest.length ? rest[i + 2] : undefined
        if (skipItem && (skipItem.photo.orientation || 'landscape') === currOri) {
          groups.push({ photos: [curr, skipItem], isChapterOpener: false, chapterId })
          pairCount += 1
          groups.push({ photos: [nextItem], isChapterOpener: false, chapterId })
          soloCount += 1
          i += 3
          continue
        }

        // Par mixto inevitable → dos solos ('single' + 'portrait')
        // NUNCA un grupo de 2 con layout de 1 slot
        groups.push({ photos: [curr], isChapterOpener: false, chapterId })
        soloCount += 1
        i += 1
        continue
      }

      groups.push({
        photos: [rest[i]],
        isChapterOpener: false,
        chapterId,
      })
      soloCount += 1
      i += 1
    }
  }

  console.log(
    `[Groups] ${chapters.length} capítulos, ${groups.length} grupos: ` +
    `${openerCount} openers, ${burstCount} ráfagas, ${pairCount} pares, ${soloCount} solos`
  )

  return groups
}
