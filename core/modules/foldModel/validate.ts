import type { Face, Fold, AlbumStructure } from './types'
import type { LayoutId } from '@/core/modules/album/layouts/registry'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'

export function getLayoutPhotoCount(layout: LayoutId): number {
  return getLayoutById(layout)?.photoCount ?? 0
}

export function isFaceValid(face: Face): boolean {
  if (face.isEmpty) return true  // hueco de edición — válido aunque photoIds esté vacío
  return getLayoutPhotoCount(face.layout) === face.photoIds.length
}

function facesOf(fold: Fold): Face[] {
  return fold.kind === 'paired' ? [fold.left, fold.right] : [fold.face]
}

/**
 * Valida dos invariantes de producto:
 *   1. Toda Face tiene el número de fotos exacto que exige su layout.
 *   2. Ningún photoId se repite en todo el álbum.
 * No lanza — devuelve la lista de problemas para que el llamador decida.
 */
export function validateAlbumStructure(album: AlbumStructure): { ok: boolean; problems: string[] } {
  const problems: string[] = []
  const seen = new Set<string>()

  for (const fold of album.folds) {
    for (const face of facesOf(fold)) {
      if (face.isEmpty) continue  // hueco de edición — no validar conteo ni unicidad

      if (!isFaceValid(face)) {
        problems.push(
          `Face "${face.id}" (layout=${face.layout}) expects ${getLayoutPhotoCount(face.layout)} photos but has ${face.photoIds.length}`
        )
      }

      for (const photoId of face.photoIds) {
        if (seen.has(photoId)) {
          problems.push(`Photo "${photoId}" appears more than once in the album`)
        }
        seen.add(photoId)
      }
    }
  }

  return { ok: problems.length === 0, problems }
}
