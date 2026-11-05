import type { LayoutSchema } from './types'
import { RITMO_PIXIA_DRAFT, type DraftLayoutSchema } from './ritmoPixia.draft'
import { HERO_SPREAD_LAYOUT } from './heroSpread'

/**
 * Fase B1 — catálogo "Ritmo Pixia" en formato de producción (LayoutSchema),
 * derivado del draft aprobado visualmente en /dev/ritmo. Se deriva
 * PROGRAMÁTICAMENTE (no se retranscribe a mano) para que no pueda divergir
 * de lo que ya se aprobó viendo fotos reales.
 *
 * Alcance de esta migración — de los 31 layouts del draft, entran:
 *   - Los de scope 'page' (no-gutter) con photoCount 1 a 5.
 * Quedan AFUERA (ver MIGRATION_EXCLUDED_IDS abajo, con el motivo de cada uno):
 *   - Los 3 spreads de gutter mejorados (hero-spread mejorado, diptych-spread,
 *     panorama-air-spread) — dependen de la regla de recorte por caras
 *     (Fase C, smart-crop). hero-spread SIN mejorar se transporta igual (ver
 *     HERO_SPREAD_LAYOUT) porque segmentChapter.ts lo necesita para el
 *     opener de capítulo, pero no es parte de "lo migrado" — no cambia nada.
 *   - Los 4 layouts de 6 fotos (grid-6, grid-6-wide, hero-banner-6,
 *     sextet-air) — requieren subir MAX_FACE_PHOTOS (foldModel/mutations.ts)
 *     y MAX_COUNT (pageEngine.ts) de 5 a 6, un cambio de límite que esta
 *     tanda no toca a propósito.
 *
 * NO se transportan los campos de solo-preview del draft (areaPercent,
 * slotArs, role, idealMoment, heroSlotIndex, isNew, replacesId) — el motor
 * real deriva AR/área/slot-dominante de la geometría en vivo (layoutFit.ts:
 * slotAspectRatios/slotAreas/getHeroSlotIndex), igual que con cualquier otro
 * layout del registry base. `tier` SÍ se transporta (ver LayoutSchema.tier)
 * aunque el motor todavía no lo use — es la pieza que necesita Fase B2.
 */

const MAX_MIGRATED_PHOTO_COUNT = 5

function toProductionSchema(draft: DraftLayoutSchema): LayoutSchema {
  const {
    id, name, photoCount, scope, grid, slots,
    innerPadding, disableMargin, slotConfig, hasAir, slotOrientations, tier,
  } = draft
  return { id, name, photoCount, scope, grid, slots, innerPadding, disableMargin, slotConfig, hasAir, slotOrientations, tier }
}

const MIGRATED_LAYOUTS: readonly LayoutSchema[] = RITMO_PIXIA_DRAFT
  .filter(l => l.scope !== 'spread' && l.photoCount <= MAX_MIGRATED_PHOTO_COUNT)
  .map(toProductionSchema)

export const RITMO_PIXIA_LAYOUTS: readonly LayoutSchema[] = [
  HERO_SPREAD_LAYOUT,
  ...MIGRATED_LAYOUTS,
]
