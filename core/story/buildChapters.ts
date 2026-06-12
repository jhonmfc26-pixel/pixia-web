import type { Chapter } from './types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Agrupa fotos en capítulos usando clustering adaptativo por gaps temporales.
 *
 * - Fotos sin EXIF (takenAt null) van a un capítulo huérfano al final.
 * - El umbral de corte se adapta al ritmo del evento: una boda (fotos cada
 *   minutos) corta por momentos; un viaje (fotos cada horas) corta por días.
 * - Capítulos con menos de 3 fotos se fusionan con su vecino temporal más cercano.
 */
export function buildChapters(
  photos: { photoId: string; takenAt: string | null }[]
): Chapter[] {
  const dated = photos.filter((p): p is { photoId: string; takenAt: string } => p.takenAt !== null)
  const orphans = photos.filter(p => p.takenAt === null)

  const chapters: Chapter[] = []

  if (dated.length > 0) {
    const sorted = [...dated].sort(
      (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()
    )

    // Gaps en ms entre fotos consecutivas
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(new Date(sorted[i].takenAt).getTime() - new Date(sorted[i - 1].takenAt).getTime())
    }

    const threshold = Math.max(TWO_HOURS_MS, median(gaps) * 4)

    // Split inicial por gaps que superan el umbral
    const clusters: Array<typeof sorted> = [[sorted[0]]]
    for (let i = 0; i < gaps.length; i++) {
      if (gaps[i] > threshold) {
        clusters.push([])
      }
      clusters[clusters.length - 1].push(sorted[i + 1])
    }

    // Fusionar capítulos con < 3 fotos con su vecino temporal más cercano
    let changed = true
    while (changed) {
      changed = false
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].length >= 3 || clusters.length === 1) continue

        let target: number
        if (i === 0) {
          target = 1
        } else if (i === clusters.length - 1) {
          target = i - 1
        } else {
          const gapToPrev =
            new Date(clusters[i][0].takenAt).getTime() -
            new Date(clusters[i - 1][clusters[i - 1].length - 1].takenAt).getTime()
          const gapToNext =
            new Date(clusters[i + 1][0].takenAt).getTime() -
            new Date(clusters[i][clusters[i].length - 1].takenAt).getTime()
          target = gapToPrev <= gapToNext ? i - 1 : i + 1
        }

        const merged =
          target < i
            ? [...clusters[target], ...clusters[i]]
            : [...clusters[i], ...clusters[target]]

        clusters.splice(Math.min(i, target), 2, merged)
        changed = true
        break
      }
    }

    // Construir Chapter por cada cluster
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      chapters.push({
        id: `chapter-${i + 1}`,
        timeRange: {
          start: cluster[0].takenAt,
          end: cluster[cluster.length - 1].takenAt,
        },
        photoIds: cluster.map(p => p.photoId),
      })
    }
  }

  // Capítulo huérfano para fotos sin EXIF
  if (orphans.length > 0) {
    chapters.push({
      id: 'chapter-orphan',
      timeRange: { start: '', end: '' },
      photoIds: orphans.map(p => p.photoId),
    })
  }

  return chapters
}
