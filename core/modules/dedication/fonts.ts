import type { DedicationBodyFontId, DedicationHeadingFontId } from '@/core/modules/foldModel/types'

/**
 * Fuentes de la dedicatoria. Cargadas globalmente vía @import en
 * app/globals.css (mismo mecanismo que Playfair Display/Inter) — no hace
 * falta ningún wiring extra acá, solo referenciar el nombre CSS.
 *
 * Restricción deliberada: pocas opciones, elegidas por carácter caligráfico
 * real (no "Dancing Script", demasiado usada y genérica) y por legibilidad
 * clásica en el cuerpo — nunca manuscrita ahí, porque el cuerpo de texto
 * tiene que leerse bien tanto en pantalla como impreso.
 */
export interface DedicationFontOption {
  id: string
  label: string
  cssFamily: string
}

export const DEDICATION_HEADING_FONTS: readonly DedicationFontOption[] = [
  { id: 'parisienne',    label: 'Parisienne',    cssFamily: "'Parisienne', cursive" },
  { id: 'pinyon-script', label: 'Pinyon Script', cssFamily: "'Pinyon Script', cursive" },
] as const

export const DEDICATION_BODY_FONTS: readonly DedicationFontOption[] = [
  { id: 'cormorant',   label: 'Cormorant',   cssFamily: "'Cormorant Garamond', Georgia, serif" },
  { id: 'eb-garamond', label: 'EB Garamond', cssFamily: "'EB Garamond', Georgia, serif" },
] as const

export function getHeadingFontFamily(id: DedicationHeadingFontId | string): string {
  return DEDICATION_HEADING_FONTS.find(f => f.id === id)?.cssFamily ?? DEDICATION_HEADING_FONTS[0].cssFamily
}

export function getBodyFontFamily(id: DedicationBodyFontId | string): string {
  return DEDICATION_BODY_FONTS.find(f => f.id === id)?.cssFamily ?? DEDICATION_BODY_FONTS[0].cssFamily
}
