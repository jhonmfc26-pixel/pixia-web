/**
 * Perfiles de impresión — fuente única de verdad de medidas físicas (mm,
 * sangrado, dpi, espacio de color) para el generador de PDF de producción.
 * NUNCA hardcodear estas medidas en otro módulo — todo pasa por acá.
 *
 * "BRICK 1": solo estructura de datos + helpers puros. No genera PDF, no
 * escribe a Supabase, no depende de React. El generador de PDF (brick
 * siguiente) se construye ENCIMA de esto, no al revés.
 */

export type ColorSpace = 'RGB' | 'CMYK'

export interface PrintProfile {
  /** '30x30' | '20x20' | 'a4v' | 'a4h' */
  id: string
  label: string
  /** Ancho de página SIN sangrado, en mm. */
  widthMm: number
  /** Alto de página SIN sangrado, en mm. */
  heightMm: number
  /** Sangrado por lado, en mm — se suma a cada borde, no es parte de widthMm/heightMm. */
  bleedMm: number
  dpi: number
  colorSpace: ColorSpace
  /** true solo para formatos ya confirmados con el partner de impresión (Range). */
  confirmed: boolean
  /** widthMm / heightMm — para que el motor de layouts arme el grid sin volver a hacer la división. */
  aspectRatio: number
}

// Medidas de 20x20/a4v/a4h son estándar de industria — se ajustan cuando
// Range confirme cada una (por eso confirmed:false). 30x30 ya está
// confirmado con el partner y es el único formato que se le muestra al
// cliente hoy (ver listConfirmedProfiles).
const PRINT_PROFILES: readonly PrintProfile[] = [
  {
    id: '30x30',
    label: 'Cuadrado grande 30×30',
    widthMm: 300, heightMm: 300, bleedMm: 3, dpi: 300,
    colorSpace: 'RGB', confirmed: true,
    aspectRatio: 300 / 300,
  },
  {
    id: '20x20',
    label: 'Cuadrado 20×20',
    widthMm: 200, heightMm: 200, bleedMm: 3, dpi: 300,
    colorSpace: 'RGB', confirmed: false,
    aspectRatio: 200 / 200,
  },
  {
    id: 'a4v',
    label: 'A4 vertical',
    widthMm: 210, heightMm: 280, bleedMm: 3, dpi: 300,
    colorSpace: 'RGB', confirmed: false,
    aspectRatio: 210 / 280, // 0.75
  },
  {
    id: 'a4h',
    label: 'A4 horizontal',
    widthMm: 280, heightMm: 210, bleedMm: 3, dpi: 300,
    colorSpace: 'RGB', confirmed: false,
    aspectRatio: 280 / 210, // 1.333...
  },
]

const DEFAULT_PROFILE_ID = '30x30'

const PROFILES_BY_ID = new Map(PRINT_PROFILES.map(p => [p.id, p]))

/**
 * Perfil por id. Nunca devuelve undefined — un id desconocido cae al
 * default (30x30, el único confirmado hoy) en vez de romper al caller.
 */
export function getPrintProfile(id: string): PrintProfile {
  return PROFILES_BY_ID.get(id) ?? PROFILES_BY_ID.get(DEFAULT_PROFILE_ID)!
}

/**
 * Dimensiones en píxeles a resolución de impresión, INCLUYENDO sangrado
 * (el archivo final que se manda a imprimir es más grande que la página
 * terminada — el sangrado se recorta después). Redondeado: los px de un
 * archivo de imprenta tienen que ser un entero.
 */
export function getPixelDimensions(profile: PrintProfile): { widthPx: number; heightPx: number } {
  const widthPx = Math.round(((profile.widthMm + 2 * profile.bleedMm) / 25.4) * profile.dpi)
  const heightPx = Math.round(((profile.heightMm + 2 * profile.bleedMm) / 25.4) * profile.dpi)
  return { widthPx, heightPx }
}

/** Formatos ya confirmados con Range — los únicos que se le deben mostrar al cliente hoy. */
export function listConfirmedProfiles(): PrintProfile[] {
  return PRINT_PROFILES.filter(p => p.confirmed)
}

/**
 * Resuelve el PrintProfile de un álbum a partir de AlbumBlueprint.format
 * ('20x20' | '30x30' | 'a4' — core/contracts/AlbumBlueprint.ts). 'a4' en el
 * modelo del blueprint es genérico (no distingue orientación); CoverRenderer
 * ya lo trata como vertical (aspectRatio 3/4 = 0.75, igual que a4v acá), así
 * que se mapea a 'a4v' para no perder esa intención — en vez de caer al
 * default solo porque el id no calza literal. Cualquier otro valor no
 * reconocido (o ausente) cae a 30x30, igual que getPrintProfile.
 */
export function getBookPrintProfile(format: string | undefined | null): PrintProfile {
  if (format === 'a4') return getPrintProfile('a4v')
  return getPrintProfile(format ?? DEFAULT_PROFILE_ID)
}
