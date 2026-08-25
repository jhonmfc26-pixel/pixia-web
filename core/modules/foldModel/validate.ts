import type { Face, Fold, AlbumStructure } from './types'
import type { LayoutId } from '@/core/modules/album/layouts/registry'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'

export function getLayoutPhotoCount(layout: LayoutId): number {
  return getLayoutById(layout)?.photoCount ?? 0
}

export function isFaceValid(face: Face): boolean {
  // Dedicatoria: no usa el sistema de slots/photoIds — válida si tiene
  // contenido de texto, sin importar photoCount del layout de referencia.
  if (face.kind === 'dedication') {
    const d = face.dedication
    return !!d && (d.heading.trim().length > 0 || d.body.trim().length > 0)
  }
  if (face.isEmpty) return true  // hueco de edición — válido aunque photoIds esté vacío
  return getLayoutPhotoCount(face.layout) === face.photoIds.length
}

function facesOf(fold: Fold): Face[] {
  return fold.kind === 'paired' ? [fold.left, fold.right] : [fold.face]
}

/** true si alguna cara del álbum ya es una dedicatoria — solo puede haber una. */
export function hasDedication(structure: AlbumStructure): boolean {
  for (const fold of structure.folds) {
    for (const face of facesOf(fold)) {
      if (face.kind === 'dedication') return true
    }
  }
  return false
}

/**
 * Cuenta las caras vacías (huecos) del álbum — ej. pliegos agregados con
 * "+ Página nueva" que el usuario todavía no llenó. Gancho para el aviso de
 * checkout ("Tienes N páginas sin fotos, ¿comprar así?"); ese aviso en sí es
 * responsabilidad del flujo de compra, no de este módulo — acá solo se deja
 * la función pura y reusable para detectarlo.
 */
export function countEmptyFaces(structure: AlbumStructure): number {
  let count = 0
  for (const fold of structure.folds) {
    for (const face of facesOf(fold)) {
      if (face.isEmpty) count++
    }
  }
  return count
}

/**
 * Cuenta las páginas físicas INTERIORES reales del álbum (sin portada) —
 * cada Fold (paired o composition/hero-spread) es un pliego de 2 páginas
 * impresas, sin importar cómo esté distribuido su contenido. Coincide con
 * la definición comercial ("20 páginas incluidas (10 spreads)" — ver
 * components/home/Pricing.tsx): 10 folds × 2 = 20 páginas.
 *
 * Es la fuente de verdad para cobrar — a diferencia de AlbumBlueprint.pageCount
 * (fijado una sola vez al generar el álbum con IA y nunca actualizado cuando
 * el usuario agrega/quita pliegos en edit-v2), esto se deriva en vivo de la
 * structure editada.
 */
export function countRealPages(structure: AlbumStructure): number {
  return structure.folds.length * 2
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
      if (face.kind === 'dedication') {
        if (!isFaceValid(face)) {
          problems.push(`Face "${face.id}" es una dedicatoria sin encabezado ni cuerpo`)
        }
        if (face.dedication?.photoId) {
          if (seen.has(face.dedication.photoId)) {
            problems.push(`Photo "${face.dedication.photoId}" appears more than once in the album`)
          }
          seen.add(face.dedication.photoId)
        }
        continue
      }

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
