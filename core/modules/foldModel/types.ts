import type { LayoutId } from '@/core/modules/album/layouts/registry'

/**
 * Una cara (cara física de una hoja): unidad mínima editable del álbum.
 * photoIds está ordenado: photoIds[0] mapea al slot 'a' (hero area en CSS Grid).
 * TODO(fase-rotar): añadir heroSlotIndex: number para permitir rotar qué foto va al slot grande.
 */
export interface Face {
  id: string
  layout: LayoutId
  photoIds: string[]
  /** true cuando la cara quedó vacía al quitar fotos (estado de edición, no error). */
  isEmpty?: boolean
}

/** Pliego normal: dos caras independientes (izquierda + derecha). */
export interface PairedFold {
  id: string
  kind: 'paired'
  left: Face
  right: Face
}

/**
 * Pliego de composición: una sola Face que ocupa el pliego completo.
 * Solo aplica a layouts con scope 'spread' (ej. hero-spread).
 */
export interface CompositionFold {
  id: string
  kind: 'composition'
  face: Face
}

export type Fold = PairedFold | CompositionFold

/**
 * Estructura mutable del álbum en el editor.
 * Diseñada para ser serializable a JSON (solo strings, arrays y objetos planos).
 * Los photoIds referencian fotos que viven en el blueprint — no se duplica PhotoAsset aquí.
 */
export interface AlbumStructure {
  folds: Fold[]
}
