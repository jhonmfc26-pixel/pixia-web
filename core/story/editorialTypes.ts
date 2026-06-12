/**
 * Tipos de decisión editorial de Pixia.
 *
 * Representan las elecciones que el motor toma sobre cómo colocar
 * cada foto en el álbum físico: dónde va, qué aspecto necesita,
 * y qué partes no puede sacrificar.
 *
 * Están separados del StoryModel deliberadamente: el story dice
 * "qué significa esta foto"; el editorial dice "cómo la ponemos en página".
 */

import type { MeaningRegion } from './types'

/**
 * Dónde va a vivir esta foto dentro del álbum impreso.
 * - `cover`: portada o contraportada — la cara del álbum.
 * - `hero-spread`: doble página completa, sin texto encima; para los clímax.
 * - `page`: página estándar dentro de un spread compuesto.
 * - `omitted`: la foto existe en el StoryModel pero no entra en el álbum final
 *   (duplicada, técnicamente débil, o el capítulo está lleno).
 */
export type EditorialPlacement = 'cover' | 'hero-spread' | 'page' | 'omitted'

/**
 * La decisión editorial sobre una foto concreta.
 *
 * Es el puente entre la historia (StoryModel) y el layout físico:
 * convierte significado narrativo en instrucciones de composición.
 * Cada decisión es trazable — el campo `reason` explica por qué
 * el sistema eligió ese placement, facilitando debugging y auditoría.
 */
export interface EditorialDecision {
  photoId: string
  /**
   * Rol de la foto en el álbum físico.
   * Determina qué template de layout se seleccionará para ella.
   */
  placement: EditorialPlacement
  /**
   * Proporción ancho:alto que el layout exige para este slot,
   * expresada como string CSS-compatible (p. ej. "16/9", "1/1", "3/2").
   * Ausente si placement es `omitted`.
   */
  targetAspect?: string
  /**
   * Copias autocontenidas de las MeaningRegions que el crop engine
   * no puede sacrificar al adaptar la foto al targetAspect.
   * El crop engine no necesita abrir el StoryModel: toda la info está aquí.
   * Si está vacío, el crop puede actuar libremente.
   */
  preserveRegions?: MeaningRegion[]
  /**
   * Explicación legible de por qué se tomó esta decisión.
   * Ejemplo: "climaxPhotoId del capítulo 2, único slot hero-spread disponible".
   * Esencial para depurar casos donde el resultado visual no es el esperado.
   */
  reason: string
}

/**
 * El plan editorial completo de un álbum: todas las decisiones ordenadas.
 *
 * `sequence` es el álbum: el índice 0 es la primera página, el último es la última.
 * Si el StoryModel que originó este plan cambia (nueva versión), el plan queda
 * obsoleto y debe regenerarse — `storyVersion` permite detectarlo.
 */
export interface EditorialPlan {
  storyModelId: string
  /** Si el StoryModel tiene una versión distinta, este plan está stale. */
  storyVersion: number
  /** El orden del array ES el orden del álbum — no reordenar. */
  sequence: EditorialDecision[]
  /** Decisión sobre la portada, tratada por separado porque tiene reglas propias. */
  coverDecision: EditorialDecision
}
