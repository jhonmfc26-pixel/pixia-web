/**
 * Los 3 formatos de álbum de Pixia (decisión de Jhon, 2026-11-06/08).
 * Fuente única para la home, la creación, el checkout y el cobro en el
 * servidor (calculateOrderTotal en lib/wompi.ts lee el precio de acá).
 *
 * Solo 3 tamaños, nunca más. Cada uno se sugiere según el momento que el
 * cliente elige en el paso 1, y el cliente puede cambiarlo.
 *
 * `available: false` = se muestra como "Muy pronto" y no se puede elegir ni
 * cobrar. Hoy los tres están a la venta (el vertical desde 2026-11-09, con
 * página 3:4 en motor, visor, editor y PDF — ver album/pageGeometry.ts).
 */

export type AlbumFormatId = '30x30' | '20x20' | '21x28'

/** Como se guarda en AlbumBlueprint.format / blueprints.format (ver printProfiles). */
export type BlueprintFormat = '30x30' | '20x20' | 'a4'

export interface AlbumFormat {
  id: AlbumFormatId
  name: string
  sizeLabel: string
  /** Para qué momento se sugiere. */
  use: string
  widthCm: number
  heightCm: number
  /** Precio base: incluye las primeras PAGES_INCLUDED páginas y el envío. */
  priceCop: number
  blueprintFormat: BlueprintFormat
  available: boolean
}

export const FORMATS: AlbumFormat[] = [
  { id: '30x30', name: 'Grande', sizeLabel: '30 × 30 cm', use: 'Bodas y grandes momentos', widthCm: 30, heightCm: 30, priceCop: 280_000, blueprintFormat: '30x30', available: true },
  { id: '20x20', name: 'Pequeño', sizeLabel: '20 × 20 cm', use: 'Niños y bebés', widthCm: 20, heightCm: 20, priceCop: 200_000, blueprintFormat: '20x20', available: true },
  { id: '21x28', name: 'Vertical', sizeLabel: '21 × 28 cm', use: 'Viajes', widthCm: 21, heightCm: 28, priceCop: 230_000, blueprintFormat: 'a4', available: true },
]

/**
 * Páginas interiores que incluye el precio base de cualquier formato. El
 * motor intenta llegar a este número aunque haya pocas fotos (ver
 * core/modules/album/fillPages.ts).
 */
export const PAGES_INCLUDED = 20

/**
 * Mínimo de páginas para poder comprar. Entre esto y PAGES_INCLUDED el
 * cliente paga igual el precio base y lo confirma en el checkout.
 */
export const MIN_ALBUM_PAGES = 10

export const DEFAULT_FORMAT_ID: AlbumFormatId = '30x30'

const BY_ID = new Map(FORMATS.map(f => [f.id, f]))

/** "20×20" — para tablas y etiquetas cortas. */
export const shortSize = (f: AlbumFormat) => `${f.widthCm}×${f.heightCm}`

export function isFormatId(v: unknown): v is AlbumFormatId {
  return typeof v === 'string' && BY_ID.has(v as AlbumFormatId)
}

/** Nunca devuelve undefined: un id desconocido cae al 30×30. */
export function getFormat(id: string | null | undefined): AlbumFormat {
  return (isFormatId(id) && BY_ID.get(id)) || BY_ID.get(DEFAULT_FORMAT_ID)!
}

/** Formato de un álbum ya creado a partir de blueprint.format ('a4' = vertical). Sin formato = 30×30 (todos los álbumes anteriores). */
export function formatOfBook(blueprintFormat: string | null | undefined): AlbumFormat {
  if (blueprintFormat === 'a4' || blueprintFormat === 'a4v' || blueprintFormat === '21x28') return BY_ID.get('21x28')!
  return getFormat(blueprintFormat)
}

/**
 * Tamaño ideal por momento (ids del paso 1). Bodas y aniversarios en grande,
 * niños en pequeño, viajes en vertical.
 */
const IDEAL_BY_STORY: Record<string, AlbumFormatId> = {
  wedding: '30x30',
  anniversary: '30x30',
  kids: '20x20',
  trip: '21x28',
  honeymoon: '21x28',
  other: '30x30',
}

export function idealFormat(story: string | null | undefined): AlbumFormat {
  return getFormat(IDEAL_BY_STORY[story ?? ''] ?? DEFAULT_FORMAT_ID)
}

/** Lo que se preselecciona: el ideal si ya se puede pedir; si no, el 30×30. */
export function suggestedFormat(story: string | null | undefined): AlbumFormat {
  const ideal = idealFormat(story)
  return ideal.available ? ideal : getFormat(DEFAULT_FORMAT_ID)
}

// Formato fijo (sin Intl) para que servidor y navegador den exactamente lo mismo.
export const formatCop = (n: number) => '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const LOWEST_PRICE_COP = Math.min(...FORMATS.filter(f => f.available).map(f => f.priceCop))
