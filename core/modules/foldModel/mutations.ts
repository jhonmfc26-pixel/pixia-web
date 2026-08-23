import type { AlbumStructure, DedicationContent, Face, Fold, PairedFold } from './types'
import type { LayoutId } from '@/core/modules/album/layouts/registry'
import { isFaceValid, hasDedication } from './validate'
import { rankLayoutsForPhotos, getHeroSlotIndex } from '@/core/modules/album/layoutFit'
import { newFoldId, newFaceId } from './ids'

// ── changeFaceLayout helpers ──────────────────────────────────────────────────

function withNewLayout(face: Face, layout: LayoutId): Face {
  return { ...face, layout }
}

function patchFoldFace(fold: Fold, faceId: string, layout: LayoutId): Fold {
  if (fold.kind === 'paired') {
    if (fold.left.id  === faceId) return { ...fold, left:  withNewLayout(fold.left,  layout) }
    if (fold.right.id === faceId) return { ...fold, right: withNewLayout(fold.right, layout) }
    return fold
  }
  if (fold.face.id === faceId) return { ...fold, face: withNewLayout(fold.face, layout) }
  return fold
}

// ── removePhoto helpers ───────────────────────────────────────────────────────

function patchFoldFaceWithFace(fold: Fold, faceId: string, updated: Face): Fold {
  if (fold.kind === 'paired') {
    if (fold.left.id  === faceId) return { ...fold, left: updated }
    if (fold.right.id === faceId) return { ...fold, right: updated }
    return fold
  }
  if (fold.face.id === faceId) return { ...fold, face: updated }
  return fold
}

// ── featurePhoto helpers ──────────────────────────────────────────────────────

/** Mueve photoId a heroIndex dentro de photoIds, desplazando el resto en orden. */
function withFeaturedPhoto(face: Face, photoId: string, heroIndex: number): Face {
  const rest = face.photoIds.filter(id => id !== photoId)
  const clampedIndex = Math.min(heroIndex, rest.length)
  const reordered = [...rest.slice(0, clampedIndex), photoId, ...rest.slice(clampedIndex)]
  const updated = { ...face, photoIds: reordered }
  if (!isFaceValid(updated)) return face  // red de seguridad — el conteo no cambia, nunca falla
  return updated
}

function patchFoldFaceFeature(fold: Fold, faceId: string, photoId: string, heroIndex: number): Fold {
  if (fold.kind === 'paired') {
    if (fold.left.id  === faceId) return { ...fold, left:  withFeaturedPhoto(fold.left,  photoId, heroIndex) }
    if (fold.right.id === faceId) return { ...fold, right: withFeaturedPhoto(fold.right, photoId, heroIndex) }
    return fold
  }
  if (fold.face.id === faceId) return { ...fold, face: withFeaturedPhoto(fold.face, photoId, heroIndex) }
  return fold
}

/**
 * Quita photoId de la cara y lo añade a bag (bolsa de reutilización).
 * - Si la cara aún tiene fotos: el layout se reeligen con rankLayoutsForPhotos.
 * - Si la cara queda vacía: se marca isEmpty=true (hueco de edición), NO se elimina.
 * Pura e inmutable. getPhotoAR permite pasar ARs reales; por defecto usa 1.0.
 */
export function removePhoto(
  structure: AlbumStructure,
  faceId: string,
  photoId: string,
  getPhotoAR: (id: string) => number = () => 1.0,
): AlbumStructure {
  let target: Face | null = null
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      if (fold.left.id  === faceId) { target = fold.left;  break }
      if (fold.right.id === faceId) { target = fold.right; break }
    } else {
      if (fold.face.id === faceId) { target = fold.face; break }
    }
  }

  if (!target) {
    console.warn('[removePhoto] faceId no encontrado:', faceId)
    return structure
  }
  if (!target.photoIds.includes(photoId)) {
    console.warn('[removePhoto] photoId no pertenece a esta cara:', photoId)
    return structure
  }

  const remaining = target.photoIds.filter(id => id !== photoId)

  let updatedFace: Face
  if (remaining.length === 0) {
    // Cara vacía → hueco de edición; conservar el layout como referencia visual
    updatedFace = { id: target.id, layout: target.layout, photoIds: [], isEmpty: true }
  } else {
    // Re-elegir layout con best-fit para el nuevo conteo
    const ars = remaining.map(id => getPhotoAR(id))
    const ranked = rankLayoutsForPhotos(ars)
    const bestLayout = (ranked[0]?.layoutId ?? target.layout) as LayoutId
    updatedFace = { id: target.id, layout: bestLayout, photoIds: remaining }
  }

  return {
    ...structure,
    folds: structure.folds.map(f => patchFoldFaceWithFace(f, faceId, updatedFace)),
  }
}

/**
 * Mueve photoId al slot dominante ("hero") de la cara faceId, calculado por
 * geometría real vía getHeroSlotIndex — NO siempre es el índice 0 (ej.
 * hero-3-top tiene el slot grande al final). Pura e inmutable.
 * Si el layout no tiene un slot dominante (simétrico), photoId ya está ahí,
 * o no pertenece a esa cara, devuelve la estructura original sin cambios.
 */
export function featurePhoto(
  structure: AlbumStructure,
  faceId: string,
  photoId: string,
): AlbumStructure {
  let target: Face | null = null
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      if (fold.left.id  === faceId) { target = fold.left;  break }
      if (fold.right.id === faceId) { target = fold.right; break }
    } else {
      if (fold.face.id === faceId) { target = fold.face; break }
    }
  }

  if (!target) {
    console.warn('[featurePhoto] faceId no encontrado:', faceId)
    return structure
  }
  if (!target.photoIds.includes(photoId)) {
    console.warn('[featurePhoto] photoId no pertenece a esta cara:', photoId)
    return structure
  }

  const heroIndex = getHeroSlotIndex(target.layout)
  if (heroIndex === null) {
    // Layout simétrico (todos los slots compiten) — el botón "Destacar" no
    // debería mostrarse en este caso; no-op por seguridad si igual se llama.
    console.warn('[featurePhoto] layout sin slot dominante — no-op:', target.layout)
    return structure
  }
  if (target.photoIds[heroIndex] === photoId) return structure  // ya es la principal

  return { ...structure, folds: structure.folds.map(f => patchFoldFaceFeature(f, faceId, photoId, heroIndex)) }
}

export const MAX_FACE_PHOTOS = 5

/**
 * Añade photoId a la cara faceId desde la bolsa derivada.
 * - Si la cara estaba vacía: pasa a 1 foto con best-fit layout.
 * - Si tenía N fotos: pasa a N+1 con best-fit relayout.
 * - Si ya tiene MAX_FACE_PHOTOS (5): no-op (el caller debe mostrar el aviso).
 * - Si photoId ya está en alguna cara: no-op (previene duplicados).
 * Pura e inmutable.
 */
export function addPhotoToFace(
  structure: AlbumStructure,
  faceId: string,
  photoId: string,
  getPhotoAR: (id: string) => number = () => 1.0,
): AlbumStructure {
  // Prevenir duplicados: el photoId no debe estar ya en ninguna cara
  for (const fold of structure.folds) {
    const faces = fold.kind === 'paired' ? [fold.left, fold.right] : [fold.face]
    for (const face of faces) {
      if (!face.isEmpty && face.photoIds.includes(photoId)) {
        console.warn('[addPhotoToFace] photoId ya está en una cara:', photoId)
        return structure
      }
    }
  }

  let target: Face | null = null
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      if (fold.left.id  === faceId) { target = fold.left;  break }
      if (fold.right.id === faceId) { target = fold.right; break }
    } else {
      if (fold.face.id === faceId) { target = fold.face; break }
    }
  }

  if (!target) {
    console.warn('[addPhotoToFace] faceId no encontrado:', faceId)
    return structure
  }
  if (!target.isEmpty && target.photoIds.length >= MAX_FACE_PHOTOS) {
    console.warn('[addPhotoToFace] cara llena — máximo', MAX_FACE_PHOTOS, 'fotos')
    return structure
  }

  const newPhotoIds = target.isEmpty ? [photoId] : [...target.photoIds, photoId]
  const ars = newPhotoIds.map(id => getPhotoAR(id))
  const ranked = rankLayoutsForPhotos(ars)
  const bestLayout = (ranked[0]?.layoutId ?? target.layout) as LayoutId

  const updatedFace: Face = { id: target.id, layout: bestLayout, photoIds: newPhotoIds }

  return {
    ...structure,
    folds: structure.folds.map(f => patchFoldFaceWithFace(f, faceId, updatedFace)),
  }
}

/**
 * Reemplaza oldPhotoId por newPhotoId EN LA MISMA POSICIÓN (mismo índice →
 * mismo slot) dentro de la cara faceId. Sin swap, sin cascada: oldPhotoId
 * simplemente sale de la cara y queda en la bolsa automáticamente (la bolsa
 * se deriva de "fotos no usadas en ninguna cara" — getBag.ts). newPhotoId
 * debe venir de la bolsa (no debe estar ya en ninguna cara), si no es no-op.
 * El conteo de fotos de la cara no cambia → el layout se conserva tal cual.
 * Pura e inmutable.
 */
export function replacePhotoFromBag(
  structure: AlbumStructure,
  faceId: string,
  oldPhotoId: string,
  newPhotoId: string,
): AlbumStructure {
  if (oldPhotoId === newPhotoId) return structure

  // newPhotoId debe venir de la bolsa: no puede estar ya en ninguna cara.
  for (const fold of structure.folds) {
    const faces = fold.kind === 'paired' ? [fold.left, fold.right] : [fold.face]
    for (const face of faces) {
      if (!face.isEmpty && face.photoIds.includes(newPhotoId)) {
        console.warn('[replacePhotoFromBag] newPhotoId ya está en una cara:', newPhotoId)
        return structure
      }
    }
  }

  let target: Face | null = null
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      if (fold.left.id  === faceId) { target = fold.left;  break }
      if (fold.right.id === faceId) { target = fold.right; break }
    } else {
      if (fold.face.id === faceId) { target = fold.face; break }
    }
  }

  if (!target) {
    console.warn('[replacePhotoFromBag] faceId no encontrado:', faceId)
    return structure
  }

  const idx = target.photoIds.indexOf(oldPhotoId)
  if (idx === -1) {
    console.warn('[replacePhotoFromBag] oldPhotoId no pertenece a esta cara:', oldPhotoId)
    return structure
  }

  const newPhotoIds = [...target.photoIds]
  newPhotoIds[idx] = newPhotoId
  const updatedFace: Face = { ...target, photoIds: newPhotoIds }

  if (!isFaceValid(updatedFace)) {
    console.warn('[replacePhotoFromBag] resultado inválido — cambio ignorado')
    return structure
  }

  return {
    ...structure,
    folds: structure.folds.map(f => patchFoldFaceWithFace(f, faceId, updatedFace)),
  }
}

/**
 * Reordena las fotos DENTRO de una misma cara — mueve fromIndex a toIndex,
 * desplazando el resto en orden. El layout NO cambia (el conteo de fotos es
 * el mismo) y ninguna foto sale de la cara — distinto de featurePhoto (que
 * mueve al slot hero) o replacePhotoFromBag (que trae una foto de afuera).
 * Pura e inmutable. No-op si los índices son inválidos o iguales.
 */
export function reorderWithinFace(
  structure: AlbumStructure,
  faceId: string,
  fromIndex: number,
  toIndex: number,
): AlbumStructure {
  let target: Face | null = null
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      if (fold.left.id  === faceId) { target = fold.left;  break }
      if (fold.right.id === faceId) { target = fold.right; break }
    } else {
      if (fold.face.id === faceId) { target = fold.face; break }
    }
  }

  if (!target) {
    console.warn('[reorderWithinFace] faceId no encontrado:', faceId)
    return structure
  }

  const { photoIds } = target
  if (
    fromIndex === toIndex ||
    fromIndex < 0 || fromIndex >= photoIds.length ||
    toIndex < 0 || toIndex >= photoIds.length
  ) {
    return structure
  }

  const reordered = [...photoIds]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)

  const updatedFace: Face = { ...target, photoIds: reordered }
  if (!isFaceValid(updatedFace)) {
    // Red de seguridad — el conteo no cambia, así que en la práctica nunca falla.
    console.warn('[reorderWithinFace] resultado inválido — cambio ignorado')
    return structure
  }

  return {
    ...structure,
    folds: structure.folds.map(f => patchFoldFaceWithFace(f, faceId, updatedFace)),
  }
}

/**
 * Cambia el layout de una cara por id. Pura e inmutable: nunca modifica la
 * estructura de entrada. Guarda la invariante: si el layout nuevo no cuadra
 * con el conteo de fotos de la cara, devuelve la estructura original sin tocar.
 */
export function changeFaceLayout(
  structure: AlbumStructure,
  faceId: string,
  newLayout: LayoutId,
): AlbumStructure {
  // Buscar la cara objetivo para validar antes de aplicar
  let target: Face | null = null
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      if (fold.left.id  === faceId) { target = fold.left;  break }
      if (fold.right.id === faceId) { target = fold.right; break }
    } else {
      if (fold.face.id === faceId) { target = fold.face; break }
    }
  }

  if (!target) {
    console.warn('[changeFaceLayout] faceId no encontrado:', faceId)
    return structure
  }

  if (!isFaceValid({ ...target, layout: newLayout })) {
    console.warn(
      `[changeFaceLayout] Layout "${newLayout}" no cuadra con ${target.photoIds.length} foto(s) — cambio ignorado`,
    )
    return structure
  }

  return { ...structure, folds: structure.folds.map(f => patchFoldFace(f, faceId, newLayout)) }
}

// ── Pliegos: agregar / eliminar (Brick 1 — "+ Página nueva") ──────────────────

/**
 * Agrega un PairedFold nuevo al final de structure.folds, con left/right
 * como caras vacías (mismo "hueco de edición" que deja removePhoto cuando
 * una cara se queda sin fotos — isEmpty:true, layout de referencia sin
 * significado visual porque FaceReadView no lo usa en huecos).
 * Marcado con userAdded:true para que removeSpread solo pueda borrar
 * pliegos agregados así, nunca los originales del álbum.
 * Pura e inmutable — nunca falla (las caras vacías son estado válido).
 */
export function addEmptySpread(structure: AlbumStructure): AlbumStructure {
  const emptyFace = (): Face => ({
    id: newFaceId(),
    layout: 'single',
    photoIds: [],
    isEmpty: true,
  })

  const newFold: PairedFold = {
    id: newFoldId(),
    kind: 'paired',
    left: emptyFace(),
    right: emptyFace(),
    userAdded: true,
  }

  return { ...structure, folds: [...structure.folds, newFold] }
}

/**
 * Elimina un pliego por id — SOLO si fue agregado por el usuario
 * (userAdded:true); no-op si es un pliego original del álbum, protegiendo
 * la paridad y el contenido generado. Las fotos que tuviera colocadas no se
 * pierden: al sacar el fold de structure, esos photoIds dejan de estar
 * referenciados en cualquier cara y getBag() los recoge automáticamente
 * como "fotos del blueprint no usadas" — no hace falta moverlas a mano,
 * el blueprint (book.spreads) no se toca acá, solo structure.
 * Pura e inmutable.
 */
export function removeSpread(structure: AlbumStructure, foldId: string): AlbumStructure {
  const fold = structure.folds.find(f => f.id === foldId)
  if (!fold) {
    console.warn('[removeSpread] foldId no encontrado:', foldId)
    return structure
  }
  if (!fold.userAdded) {
    console.warn('[removeSpread] no se puede eliminar un pliego original:', foldId)
    return structure
  }

  return { ...structure, folds: structure.folds.filter(f => f.id !== foldId) }
}

// ── Dedicatoria (Brick 2) — UNA sola por álbum, en cualquier cara vacía ────────

function findFace(structure: AlbumStructure, faceId: string): Face | null {
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      if (fold.left.id  === faceId) return fold.left
      if (fold.right.id === faceId) return fold.right
    } else {
      if (fold.face.id === faceId) return fold.face
    }
  }
  return null
}

/**
 * Convierte una cara VACÍA en una dedicatoria (carta), sembrada con `seed`
 * (el caller arma la plantilla según book.occasion — mutations.ts no conoce
 * de ocasiones, solo de estructura). Restricción dura: solo puede haber una
 * dedicatoria en todo el álbum — no-op si ya existe una, aunque el botón que
 * dispara esto ya debería estar oculto en ese caso (red de seguridad).
 * Pura e inmutable.
 */
export function convertToDedication(
  structure: AlbumStructure,
  faceId: string,
  seed: DedicationContent,
): AlbumStructure {
  if (hasDedication(structure)) {
    console.warn('[convertToDedication] ya existe una dedicatoria en el álbum — no-op')
    return structure
  }

  const target = findFace(structure, faceId)
  if (!target) {
    console.warn('[convertToDedication] faceId no encontrado:', faceId)
    return structure
  }
  if (!target.isEmpty) {
    console.warn('[convertToDedication] la cara no está vacía:', faceId)
    return structure
  }

  const updatedFace: Face = {
    id: target.id,
    layout: target.layout,
    photoIds: [],
    isEmpty: false,
    kind: 'dedication',
    dedication: seed,
  }

  return { ...structure, folds: structure.folds.map(f => patchFoldFaceWithFace(f, faceId, updatedFace)) }
}

/**
 * Revierte una dedicatoria a cara de fotos vacía (mismo hueco de edición que
 * cualquier otra) — el usuario la llena de nuevo con las herramientas ya
 * existentes. La foto que tuviera la dedicatoria (si alguna) no se pierde:
 * al dejar de estar referenciada, getBag() la recoge como bolsa automático.
 * Libera el cupo de "una sola dedicatoria" para que la opción reaparezca en
 * otras caras vacías. Pura e inmutable.
 */
export function revertDedicationToPhotos(structure: AlbumStructure, faceId: string): AlbumStructure {
  const target = findFace(structure, faceId)
  if (!target) {
    console.warn('[revertDedicationToPhotos] faceId no encontrado:', faceId)
    return structure
  }
  if (target.kind !== 'dedication') {
    console.warn('[revertDedicationToPhotos] la cara no es una dedicatoria:', faceId)
    return structure
  }

  const updatedFace: Face = {
    id: target.id,
    layout: target.layout,
    photoIds: [],
    isEmpty: true,
    kind: 'photos',
  }

  return { ...structure, folds: structure.folds.map(f => patchFoldFaceWithFace(f, faceId, updatedFace)) }
}

/**
 * Actualiza campos de una dedicatoria existente (heading/body/signature,
 * tipografías, foto) — edición en vivo desde el panel. Pura e inmutable.
 */
export function updateDedication(
  structure: AlbumStructure,
  faceId: string,
  patch: Partial<DedicationContent>,
): AlbumStructure {
  const target = findFace(structure, faceId)
  if (!target || target.kind !== 'dedication' || !target.dedication) {
    console.warn('[updateDedication] la cara no es una dedicatoria válida:', faceId)
    return structure
  }

  const updatedFace: Face = { ...target, dedication: { ...target.dedication, ...patch } }
  return { ...structure, folds: structure.folds.map(f => patchFoldFaceWithFace(f, faceId, updatedFace)) }
}
