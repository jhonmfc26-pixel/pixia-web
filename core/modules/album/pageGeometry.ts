/**
 * Proporción de la página del álbum (ancho / alto) para el motor de layouts.
 *
 * Hasta el formato vertical todo el motor suponía página cuadrada (30×30 y
 * 20×20). El vertical 21×28 tiene páginas de 0.75: un slot que en cuadrado es
 * 1:1 en vertical es 3:4, así que la elección de layout, el orden de las
 * fotos en los slots y los recortes cambian.
 *
 * El motor es síncrono y puro, así que en vez de pasar la proporción por
 * cada función (segmentChapter, rhythmEngine, fillPages, mutations…), las
 * entradas la fijan con `withPageAspect(aspect, fn)` y las funciones de
 * geometría (layoutFit) la leen con `pageAspect()`. El editor, que vive en
 * una sola página por álbum, la fija con `setPageAspect` mientras está
 * montado. En React (visor, editor) se usa PageAspectContext.
 */
import { formatOfBook } from '@/lib/formats'

export const SQUARE = 1

let current = SQUARE

export const pageAspect = () => current

export function withPageAspect<T>(aspect: number, fn: () => T): T {
  const prev = current
  current = aspect
  try { return fn() } finally { current = prev }
}

/** Para el editor (una página = un álbum): fijar al montar y volver a SQUARE al desmontar. */
export function setPageAspect(aspect: number) {
  current = aspect
}

/** Proporción de página de un álbum a partir de blueprint.format ('30x30' | '20x20' | 'a4'). */
export function aspectOfFormat(format: string | null | undefined): number {
  const f = formatOfBook(format)
  return f.widthCm / f.heightCm
}

export const isVerticalAspect = (aspect: number) => aspect < 0.95
