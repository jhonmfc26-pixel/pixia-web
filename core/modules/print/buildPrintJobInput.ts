import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import { validateAlbumStructure } from '@/core/modules/foldModel/validateStructure'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import type { CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'

/**
 * Todo lo que el motor de PDF necesita para generar interior + cubierta de
 * un álbum, armado desde la fila cruda de `blueprints` en Supabase.
 *
 * ÚNICA fuente de verdad de este armado: la usan el procesador de la cola de
 * producción (services/pdf-render-container, POST /process-pending) y la
 * creación de órdenes (lib/orderAlbum.ts), para que las páginas que se
 * cobran sean exactamente las que tiene el PDF.
 */
export interface PrintJobInput {
  structure: AlbumStructure
  photos: Record<string, PhotoAsset>
  cover: CoverConfig
  coverPhoto?: PhotoAsset
  format: string
}

export type BuildPrintJobInputResult =
  | { ok: true; input: PrintJobInput; warnings: string[] }
  | { ok: false; reason: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPrintJobInput(rawBlueprint: any, albumId: string): BuildPrintJobInputResult {
  const warnings: string[] = []
  const book = normalizeBook(rawBlueprint, albumId)

  // structure guardada por el editor si es válida; si no, derivada del
  // blueprint (mismo criterio que tenía la ruta dev).
  let structure: AlbumStructure
  if (book.structure) {
    const knownIds = new Set<string>()
    for (const s of book.spreads) for (const p of s.photos) knownIds.add(p.id)
    const validation = validateAlbumStructure(book.structure, knownIds)
    if (validation.ok) {
      structure = book.structure
    } else {
      structure = foldsFromBlueprint(book).structure
      warnings.push(`structure guardada inválida, derivada desde el blueprint: ${validation.reason}`)
    }
  } else {
    structure = foldsFromBlueprint(book).structure
  }

  if (structure.folds.length === 0) {
    return { ok: false, reason: `El álbum "${albumId}" no tiene pliegos (structure vacía) — no hay nada que generar.` }
  }

  const photosById = new Map<string, PhotoAsset>()
  for (const spread of book.spreads) {
    for (const photo of spread.photos) photosById.set(photo.id, photo)
  }
  const coverPhoto = (book.cover.photoId && photosById.get(book.cover.photoId)) || [...photosById.values()][0]

  return {
    ok: true,
    input: {
      structure,
      photos: Object.fromEntries(photosById),
      cover: book.cover,
      coverPhoto,
      format: book.format,
    },
    warnings,
  }
}
