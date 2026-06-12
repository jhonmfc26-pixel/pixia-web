/**
 * Verificación manual del algoritmo buildChapters.
 * Correr con: npx tsx scripts/testChapters.ts
 */
import { buildChapters } from '../core/story/buildChapters'
import type { Chapter } from '../core/story/types'

function ts(base: Date, offsetMinutes: number): string {
  return new Date(base.getTime() + offsetMinutes * 60_000).toISOString()
}

function printChapters(label: string, chapters: Chapter[], expectedCount: number) {
  const ok = chapters.length === expectedCount
  console.log(`\n── ${label}`)
  console.log(`   Capítulos: ${chapters.length} (esperados: ${expectedCount}) ${ok ? '✓' : '✗ FALLO'}`)
  for (const ch of chapters) {
    const start = ch.timeRange.start ? new Date(ch.timeRange.start).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : 'sin-fecha'
    const end   = ch.timeRange.end   ? new Date(ch.timeRange.end).toLocaleTimeString('es',   { hour: '2-digit', minute: '2-digit' }) : 'sin-fecha'
    console.log(`   [${ch.id}] ${ch.photoIds.length} fotos | ${start} → ${end}`)
  }
}

// ── Caso 1: Boda ─────────────────────────────────────────────────────────────
// 30 fotos en un día con 3 momentos densos.
// Ceremony (10:00-10:54), lunch (14:00-14:54), party (19:00-21:42).
// Gaps entre momentos: ~186 min y ~246 min → ambos > 2 horas → 3 capítulos.
;(() => {
  const day = new Date('2024-06-15T10:00:00')
  const photos: { photoId: string; takenAt: string }[] = []

  // Ceremony: 10 fotos cada 6 min
  for (let i = 0; i < 10; i++) photos.push({ photoId: `c-${i}`, takenAt: ts(day, i * 6) })
  // Lunch: 10 fotos cada 6 min, empieza 2h y 6 min después de la última de ceremony
  const lunchStart = 10 * 6 + 126  // 186 min desde las 10:00
  for (let i = 0; i < 10; i++) photos.push({ photoId: `l-${i}`, takenAt: ts(day, lunchStart + i * 6) })
  // Party: 10 fotos cada 18 min, empieza 4h y 6 min después de la última de lunch
  const partyStart = lunchStart + 10 * 6 + 246
  for (let i = 0; i < 10; i++) photos.push({ photoId: `p-${i}`, takenAt: ts(day, partyStart + i * 18) })

  printChapters('BODA (30 fotos, 3 momentos en un día)', buildChapters(photos), 3)
})()

// ── Caso 2: Viaje ─────────────────────────────────────────────────────────────
// 40 fotos en 5 días, 8 fotos por día cada 30 min.
// Gap entre días: ~20.5 horas >> umbral adaptativo → 5 capítulos.
;(() => {
  const photos: { photoId: string; takenAt: string }[] = []
  for (let day = 0; day < 5; day++) {
    const dayBase = new Date(`2024-07-0${day + 1}T08:00:00`)
    for (let i = 0; i < 8; i++) {
      photos.push({ photoId: `v-${day}-${i}`, takenAt: ts(dayBase, i * 30) })
    }
  }
  printChapters('VIAJE (40 fotos, 5 días)', buildChapters(photos), 5)
})()

// ── Caso 3: Sin EXIF ──────────────────────────────────────────────────────────
// 10 fotos sin fecha → 1 capítulo huérfano.
;(() => {
  const photos = Array.from({ length: 10 }, (_, i) => ({
    photoId: `orphan-${i}`,
    takenAt: null as string | null,
  }))
  printChapters('SIN EXIF (10 fotos null)', buildChapters(photos), 1)
})()

console.log('')
