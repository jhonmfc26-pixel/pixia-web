/**
 * Validación de AlbumStructure antes de persistir o cargar desde localStorage.
 * Función pura — sin efectos secundarios ni imports de dominio externo.
 */
import { getLayoutById } from '@/core/modules/album/layouts/helpers'

export interface ValidationResult {
  ok: boolean
  reason?: string
}

/**
 * Valida que una AlbumStructure sea bien formada y, opcionalmente, que
 * sus photoIds coincidan exactamente con los del blueprint.
 *
 * @param structure   Valor a validar (tipado como unknown para aceptar JSON crudo).
 * @param knownPhotoIds  Set de todos los IDs de fotos del blueprint. Si se provee,
 *                       se exige coincidencia exacta (sin extras ni faltantes).
 *                       Discrepancia → re-derivar es mejor que mostrar huecos.
 */
export function validateAlbumStructure(
  structure: unknown,
  knownPhotoIds?: Set<string>,
): ValidationResult {
  if (!structure || typeof structure !== 'object' || Array.isArray(structure)) {
    return { ok: false, reason: 'structure no es un objeto' }
  }

  const s = structure as Record<string, unknown>

  if (!Array.isArray(s.folds) || s.folds.length === 0) {
    return { ok: false, reason: 'folds vacío o ausente' }
  }

  const structurePhotoIds = new Set<string>()

  for (let fi = 0; fi < s.folds.length; fi++) {
    const fold = s.folds[fi]
    if (!fold || typeof fold !== 'object' || Array.isArray(fold)) {
      return { ok: false, reason: `fold[${fi}] no es un objeto` }
    }

    const f = fold as Record<string, unknown>
    if (typeof f.id !== 'string' || !f.id) {
      return { ok: false, reason: `fold[${fi}] sin id` }
    }
    if (f.kind !== 'paired' && f.kind !== 'composition') {
      return { ok: false, reason: `fold[${fi}] kind inválido: ${String(f.kind)}` }
    }

    const facesToCheck: unknown[] =
      f.kind === 'paired' ? [f.left, f.right] : [f.face]

    for (const faceVal of facesToCheck) {
      if (!faceVal || typeof faceVal !== 'object' || Array.isArray(faceVal)) {
        return { ok: false, reason: `fold[${fi}] tiene una face inválida` }
      }
      const face = faceVal as Record<string, unknown>

      if (typeof face.id !== 'string' || !face.id) {
        return { ok: false, reason: `fold[${fi}] face sin id` }
      }
      if (typeof face.layout !== 'string' || !getLayoutById(face.layout as string)) {
        return { ok: false, reason: `fold[${fi}] layout desconocido: ${String(face.layout)}` }
      }
      if (!Array.isArray(face.photoIds)) {
        return { ok: false, reason: `fold[${fi}] face.photoIds no es array` }
      }

      const faceIsEmpty = face.isEmpty === true
      if (!faceIsEmpty && face.photoIds.length === 0) {
        return { ok: false, reason: `fold[${fi}] face.photoIds vacío` }
      }

      for (const pid of face.photoIds) {
        if (typeof pid !== 'string' || !pid) {
          return { ok: false, reason: `fold[${fi}] photoId inválido` }
        }
        structurePhotoIds.add(pid)
      }
    }
  }

  // Integridad referencial: las fotos en caras deben existir en el blueprint.
  // Fotos del blueprint no presentes en ninguna cara están en la bolsa derivada — válido.
  if (knownPhotoIds) {
    for (const pid of structurePhotoIds) {
      if (!knownPhotoIds.has(pid)) {
        return { ok: false, reason: `foto "${pid}" en estructura pero no en blueprint` }
      }
    }
  }

  return { ok: true }
}
