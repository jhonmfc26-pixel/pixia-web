import type { AlbumStructure } from './types'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'

/**
 * Deriva la bolsa: todas las PhotoAsset del blueprint que no aparecen en
 * ninguna cara de la estructura actual. Pura — no lee estado ni produce efectos.
 *
 * bolsa = blueprint photos − caras (no vacías) photos
 *
 * Las fotos quitadas con removePhoto vuelven a aparecer aquí automáticamente
 * porque ya no están en ninguna cara. No hace falta persistir la bolsa aparte.
 */
export function getBag(
  structure: AlbumStructure,
  allPhotos: PhotoAsset[],
): PhotoAsset[] {
  const usedIds = new Set<string>()
  for (const fold of structure.folds) {
    const faces = fold.kind === 'paired' ? [fold.left, fold.right] : [fold.face]
    for (const face of faces) {
      if (!face.isEmpty) {
        for (const id of face.photoIds) usedIds.add(id)
      }
    }
  }
  return allPhotos.filter(p => !usedIds.has(p.id))
}
