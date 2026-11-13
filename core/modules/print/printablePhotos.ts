import type { AlbumStructure, Face, Fold } from '@/core/modules/foldModel/types'
import { resolveCover } from '@/core/modules/cover/coverDesign'
import type { PrintJobInput } from './buildPrintJobInput'

/**
 * Fotos del álbum que NO se pueden imprimir: están colocadas en una página (o
 * en la portada) pero no quedaron subidas al almacenamiento — su dirección es
 * una copia comprimida guardada dentro del álbum (data:), una referencia local
 * del navegador (blob:) o está vacía. Impresas salen pixeladas o en blanco.
 *
 * Función pura: la usa el contenedor de PDF antes de generar nada.
 */
export interface UnprintablePhoto {
  photoId: string
  where: 'interior' | 'portada'
  reason: 'no está en el álbum' | 'no terminó de subir'
}

const facesOf = (fold: Fold): Face[] => (fold.kind === 'paired' ? [fold.left, fold.right] : [fold.face])

/** Ids de las fotos colocadas en alguna página del interior. */
export function placedPhotoIds(structure: AlbumStructure): string[] {
  const ids = new Set<string>()
  for (const fold of structure.folds) {
    for (const face of facesOf(fold)) {
      if (face.kind === 'dedication') {
        if (face.dedication?.photoId) ids.add(face.dedication.photoId)
      } else {
        for (const id of face.photoIds ?? []) ids.add(id)
      }
    }
  }
  return [...ids]
}

/** Una foto subida vive en una dirección https. */
export const isPrintableUrl = (url: unknown): boolean => typeof url === 'string' && /^https:\/\/\S+$/.test(url)

export function findUnprintablePhotos(input: Pick<PrintJobInput, 'structure' | 'photos' | 'cover' | 'coverPhoto'>): UnprintablePhoto[] {
  const out: UnprintablePhoto[] = []
  for (const photoId of placedPhotoIds(input.structure)) {
    const photo = input.photos[photoId]
    if (!photo) out.push({ photoId, where: 'interior', reason: 'no está en el álbum' })
    else if (!isPrintableUrl(photo.url)) out.push({ photoId, where: 'interior', reason: 'no terminó de subir' })
  }
  // La portada solo depende de una foto cuando es de las de foto (no las gráficas).
  if (resolveCover(input.cover).kind === 'photo' && input.coverPhoto && !isPrintableUrl(input.coverPhoto.url)) {
    out.push({ photoId: input.coverPhoto.id, where: 'portada', reason: 'no terminó de subir' })
  }
  return out
}

/** Mensaje para la alerta al equipo: qué pasó y qué hay que hacer. */
export function describeUnprintable(problems: UnprintablePhoto[]): string {
  const n = problems.length
  const ids = problems.slice(0, 5).map(p => `${p.photoId} (${p.where}: ${p.reason})`).join(', ')
  return `${n === 1 ? 'Una foto del álbum no se puede imprimir' : `${n} fotos del álbum no se pueden imprimir`}: ${ids}${n > 5 ? ` y ${n - 5} más` : ''}. `
    + 'No están en el almacenamiento de Pixia, así que saldrían pixeladas o en blanco. Hay que pedirle al cliente que las vuelva a subir.'
}
