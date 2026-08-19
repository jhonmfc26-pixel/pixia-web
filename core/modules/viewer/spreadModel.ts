import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { AlbumStructure, Face } from '@/core/modules/foldModel/types'

/**
 * Un "pliego" (spread) tal como lo ve el viewer: portada, contraportada,
 * dos caras independientes (paired), o una única cara a doble página
 * (composition — ej. hero-spread, que nunca se parte entre pliegos).
 */
export type ViewerSpread =
  | { kind: 'cover' }
  | { kind: 'paired'; left: Face; right: Face }
  | { kind: 'composition'; face: Face }
  | { kind: 'back' }

export function buildSpreads(structure: AlbumStructure | null): ViewerSpread[] {
  if (!structure) return []
  const result: ViewerSpread[] = [{ kind: 'cover' }]
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      result.push({ kind: 'paired', left: fold.left, right: fold.right })
    } else {
      result.push({ kind: 'composition', face: fold.face })
    }
  }
  result.push({ kind: 'back' })
  return result
}

export function isSingleSpread(s: ViewerSpread | undefined): boolean {
  return !s || s.kind === 'cover' || s.kind === 'back'
}

/** Extrae las URLs de todas las fotos de un pliego, para precargarlas. */
export function getSpreadUrls(
  s: ViewerSpread,
  photosById: Map<string, PhotoAsset>,
  coverPhoto: PhotoAsset | undefined,
): string[] {
  const urls: string[] = []
  const addFace = (face: Face) => {
    for (const id of face.photoIds) {
      const p = photosById.get(id)
      const url = p?.url || p?.thumbnailUrl
      if (url) urls.push(url)
    }
  }
  if (s.kind === 'cover') {
    const u = coverPhoto?.url || coverPhoto?.thumbnailUrl
    if (u) urls.push(u)
  } else if (s.kind === 'paired') {
    addFace(s.left); addFace(s.right)
  } else if (s.kind === 'composition') {
    addFace(s.face)
  }
  return urls
}

/**
 * Mapeo entre índice de pliego (spreadIdx, incluye cover/back) e índice de
 * página física de react-pageflip (con showCover=true, la portada y la
 * contraportada quedan solas; cada pliego intermedio ocupa 2 páginas).
 */
export function spreadIdxToPageIndex(spreadIdx: number, spreadsLength: number): number {
  if (spreadIdx <= 0) return 0
  const totalPages = 2 * spreadsLength - 2
  if (spreadIdx >= spreadsLength - 1) return totalPages - 1
  return 1 + (spreadIdx - 1) * 2
}

export function pageIndexToSpreadIdx(pageIndex: number, spreadsLength: number): number {
  if (pageIndex <= 0) return 0
  const totalPages = 2 * spreadsLength - 2
  if (pageIndex >= totalPages - 1) return spreadsLength - 1
  return 1 + Math.floor((pageIndex - 1) / 2)
}
