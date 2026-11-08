/**
 * Los 3 formatos de álbum de Pixia (decisión de Jhon, 2026-11-06/08).
 * Una sola fuente para la home y, después, para la creación y el checkout.
 *
 * Por ahora el flujo de creación y el cobro son solo del 30×30; el selector de
 * formato por ocasión llega en el siguiente PR. Los precios del 20×20 y del
 * vertical son los definidos por Jhon (el vertical, provisional).
 */
import { PRICING } from '@/lib/wompi'

export type AlbumFormatId = '30x30' | '20x20' | '21x28'

export interface AlbumFormat {
  id: AlbumFormatId
  name: string
  sizeLabel: string
  /** Para qué momento se sugiere. */
  use: string
  widthCm: number
  heightCm: number
  priceCop: number
}

export const FORMATS: AlbumFormat[] = [
  { id: '30x30', name: 'Grande', sizeLabel: '30 × 30 cm', use: 'Bodas y grandes momentos', widthCm: 30, heightCm: 30, priceCop: PRICING.basePriceCop },
  { id: '20x20', name: 'Pequeño', sizeLabel: '20 × 20 cm', use: 'Niños y bebés', widthCm: 20, heightCm: 20, priceCop: 200_000 },
  { id: '21x28', name: 'Vertical', sizeLabel: '21 × 28 cm', use: 'Viajes', widthCm: 21, heightCm: 28, priceCop: 230_000 },
]

// Formato fijo (sin Intl) para que servidor y navegador den exactamente lo mismo.
export const formatCop = (n: number) => '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const LOWEST_PRICE_COP = Math.min(...FORMATS.map(f => f.priceCop))
