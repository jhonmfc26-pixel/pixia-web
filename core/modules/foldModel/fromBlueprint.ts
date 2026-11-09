import type { AlbumBlueprint } from '@/core/contracts/AlbumBlueprint'
import { extractPhotoPool, buildPages } from '@/core/modules/album/pageEngine'
import { foldsFromPages } from './fromPages'
import { withPageAspect, aspectOfFormat } from '@/core/modules/album/pageGeometry'
import type { AlbumStructure } from './types'

/**
 * Deriva AlbumStructure (Fold[]) de un AlbumBlueprint existente.
 * Pura — no escribe a localStorage, no llama a Supabase, no muta el book.
 *
 * Flujo:
 *   spreads → extractPhotoPool → buildPages → foldsFromPages → AlbumStructure
 *
 * Los layoutConfig overrides del editor viejo NO se arrastran: se parte de
 * la generación base. Los overrides nuevos viven directamente en el Fold/Face.
 */
export function foldsFromBlueprint(
  // manualPhotoOrder vive en el blueprint serializado pero no en el tipo —
  // mismo patrón que usaba el editor viejo (ya eliminado) para leerlo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  book: AlbumBlueprint & { manualPhotoOrder?: string[] },
): { structure: AlbumStructure; problems: string[] } {
  const pool = extractPhotoPool(book.spreads, book.manualPhotoOrder)
  // Layouts y recortes según la proporción de página del formato (vertical 3:4).
  const { pages } = withPageAspect(aspectOfFormat(book.format), () => buildPages(pool))
  return foldsFromPages(pages)
}
