import type { LayoutId } from '@/core/modules/album/layouts/registry'

/** Manuscritas con carácter caligráfico real — deliberadamente pocas opciones. */
export type DedicationHeadingFontId = 'parisienne' | 'pinyon-script'

/** Serifs clásicas legibles en pantalla e impresión (nunca manuscritas). */
export type DedicationBodyFontId = 'cormorant' | 'eb-garamond'

/**
 * Contenido de una cara de dedicatoria (carta). photoId es independiente de
 * photoIds de Face — una carta no usa el sistema de slots/layout de fotos.
 */
export interface DedicationContent {
  heading: string
  body: string
  signature: string
  headingFont: DedicationHeadingFontId
  bodyFont: DedicationBodyFontId
  photoId?: string
}

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
  /** 'photos' (default, implícito) o 'dedication' — carta de texto, única por álbum. */
  kind?: 'photos' | 'dedication'
  /** Solo presente cuando kind === 'dedication'. photoIds se ignora en ese caso. */
  dedication?: DedicationContent
}

/** Pliego normal: dos caras independientes (izquierda + derecha). */
export interface PairedFold {
  id: string
  kind: 'paired'
  left: Face
  right: Face
  /** true si el usuario lo agregó desde el editor (addEmptySpread) — solo esos se pueden eliminar. */
  userAdded?: boolean
}

/**
 * Pliego de composición: una sola Face que ocupa el pliego completo.
 * Solo aplica a layouts con scope 'spread' (ej. hero-spread).
 */
export interface CompositionFold {
  id: string
  kind: 'composition'
  face: Face
  /** true si el usuario lo agregó desde el editor — solo esos se pueden eliminar. */
  userAdded?: boolean
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
