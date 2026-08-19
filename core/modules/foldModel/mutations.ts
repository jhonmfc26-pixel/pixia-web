import type { AlbumStructure, Face, Fold } from './types'
import type { LayoutId } from '@/core/modules/album/layouts/registry'
import { isFaceValid } from './validate'
import { rankLayoutsForPhotos } from '@/core/modules/album/layoutFit'

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

function withFeaturedPhoto(face: Face, photoId: string): Face {
  const reordered = [photoId, ...face.photoIds.filter(id => id !== photoId)]
  const updated = { ...face, photoIds: reordered }
  if (!isFaceValid(updated)) return face  // red de seguridad — el conteo no cambia, nunca falla
  return updated
}

function patchFoldFaceFeature(fold: Fold, faceId: string, photoId: string): Fold {
  if (fold.kind === 'paired') {
    if (fold.left.id  === faceId) return { ...fold, left:  withFeaturedPhoto(fold.left,  photoId) }
    if (fold.right.id === faceId) return { ...fold, right: withFeaturedPhoto(fold.right, photoId) }
    return fold
  }
  if (fold.face.id === faceId) return { ...fold, face: withFeaturedPhoto(fold.face, photoId) }
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
 * Mueve photoId al slot 0 de la cara faceId (slot dominante en layouts con hero).
 * Pura e inmutable. Si photoId ya está en posición 0, o no pertenece a esa cara,
 * devuelve la estructura original sin cambios.
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
  if (target.photoIds[0] === photoId) return structure  // ya es la principal

  return { ...structure, folds: structure.folds.map(f => patchFoldFaceFeature(f, faceId, photoId)) }
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
