import type { Page } from '@/core/modules/album/types'
import type { AlbumStructure, Face, PairedFold, CompositionFold } from './types'
import { newFoldId, newFaceId } from './ids'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'

function faceFromPage(page: Page): Face {
  return { id: newFaceId(), layout: page.layout, photoIds: [...page.photoIds] }
}

/**
 * Traduce la lista plana de Page (un Page = un lado) producida por buildPages
 * en la lista de Fold que el editor maneja directamente.
 *
 * Reglas de emparejamiento:
 *  - Un hero-spread (scope='spread') viene como dos Page consecutivas
 *    (spreadHalf 'left' + 'right'). Se colapsan en un CompositionFold.
 *  - Dos páginas normales consecutivas forman un PairedFold.
 *  - Cualquier desalineación (spread huérfano, número impar de lados) se
 *    reporta en `problems`; NO se inventan páginas en blanco.
 *
 * Función pura — sin efectos, sin persistencia.
 */
export function foldsFromPages(pages: Page[]): { structure: AlbumStructure; problems: string[] } {
  const folds: (PairedFold | CompositionFold)[] = []
  const problems: string[] = []
  let pendingLeft: Face | null = null
  let i = 0

  while (i < pages.length) {
    const page = pages[i]
    const isSpread = getLayoutById(page.layout)?.scope === 'spread'

    if (isSpread) {
      if (pendingLeft !== null) {
        problems.push(
          `Cara huérfana antes de composición: "${pendingLeft.id}" (layout=${pendingLeft.layout})`
        )
        pendingLeft = null
      }

      const next = pages[i + 1]
      if (!next || next.spreadHalf !== 'right') {
        problems.push(
          `Spread sin mitad derecha en índice ${i}: página "${page.id}" (layout=${page.layout})`
        )
        i += 1
        continue
      }

      folds.push({
        id: newFoldId(),
        kind: 'composition',
        face: faceFromPage(page),
      })
      i += 2
      continue
    }

    // Página normal
    if (pendingLeft === null) {
      pendingLeft = faceFromPage(page)
    } else {
      folds.push({
        id: newFoldId(),
        kind: 'paired',
        left: pendingLeft,
        right: faceFromPage(page),
      })
      pendingLeft = null
    }
    i += 1
  }

  if (pendingLeft !== null) {
    problems.push(`Cara huérfana al final: "${pendingLeft.id}" (layout=${pendingLeft.layout})`)
  }

  return { structure: { folds }, problems }
}
