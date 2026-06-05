import type { AlbumFormat } from './types'

export const ALBUM_FORMATS: Record<string, AlbumFormat> = {
  'square-30': {
    id: 'square-30',
    page: {
      widthCm: 30,
      heightCm: 30,
      bleedMm: 3,
    },
    binding: 'lay-flat',
    print: {
      dpi: 300,
    },
  },
}

export const DEFAULT_FORMAT_ID = 'square-30'

/**
 * Obtiene un formato por id. Retorna el default si el id es inválido o no existe.
 * Esto garantiza que álbumes antiguos sin formatId sigan funcionando.
 */
export function getFormatById(id?: string): AlbumFormat {
  if (id && ALBUM_FORMATS[id]) return ALBUM_FORMATS[id]
  return ALBUM_FORMATS[DEFAULT_FORMAT_ID]
}
