import type { PhotoAnalysisEntry } from '@/core/modules/upload/photoSession'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import { buildPages } from './pageEngine'
import { withPageAspect, aspectOfFormat } from './pageGeometry'
import { foldsFromPages } from '@/core/modules/foldModel/fromPages'
import { countRealPages } from '@/core/modules/foldModel/validate'

/**
 * Cuántas páginas tendrá el álbum con estas fotos, con el mismo motor que lo
 * arma después (buildPages + relleno hacia las incluidas). Se usa en el paso
 * de fotos para avisar "tu álbum tendrá 16 de 20 páginas" antes de crearlo,
 * que es cuando el cliente todavía puede subir más.
 */
export function estimateAlbumPages(entries: PhotoAnalysisEntry[], format?: string): number {
  if (entries.length === 0) return 0
  const pool = entries.map(e => ({
    act: 'desarrollo' as const,
    photo: {
      id: e.id, src: '', url: '',
      width: e.width, height: e.height, orientation: e.orientation,
      score: e.score, takenAt: e.takenAt,
    } as unknown as PhotoAsset,
  }))
  const { pages } = withPageAspect(aspectOfFormat(format), () => buildPages(pool))
  return countRealPages(foldsFromPages(pages).structure)
}
