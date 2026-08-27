'use client'

import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { Face } from '@/core/modules/foldModel/types'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import { DedicationCard } from '@/core/modules/dedication/DedicationCard'
import PixiaImage from '@/components/ui/PixiaImage'

/**
 * Miniatura LIVIANA de una cara — mismo grid que FacePageView (SpreadFaces.tsx)
 * pero prioriza thumbnailUrl sobre url (foto a resolución completa) y marca
 * las imágenes loading="lazy". Existe aparte de FacePageView a propósito: en
 * un álbum de 25+ pliegos la tira de miniaturas puede tener 50+ de estas
 * montadas a la vez — reusar FacePageView tal cual (que prioriza url) bajaría
 * la foto completa 50+ veces solo para mostrarla del tamaño de un sello.
 * Dedicatoria: reusa DedicationCard directo (ya es liviana — poco texto, sin
 * grid de fotos, y su propia foto opcional ya pasa por PixiaImage).
 */
export function FaceThumbnail({ face, photosById }: {
  face: Face
  photosById: Map<string, PhotoAsset>
}) {
  if (face.kind === 'dedication' && face.dedication) {
    const photo = face.dedication.photoId ? photosById.get(face.dedication.photoId) : undefined
    return <DedicationCard dedication={face.dedication} photo={photo} />
  }

  if (face.isEmpty) {
    return <div style={{ width: '100%', height: '100%', background: '#F9F6F1' }} />
  }

  const schema = getLayoutById(face.layout)
  if (!schema) {
    return <div style={{ width: '100%', height: '100%', background: '#111' }} />
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      padding: schema.innerPadding ?? '0px',
      boxSizing: 'border-box',
      background: schema.hasAir ? '#F9F6F1' : undefined,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: schema.grid.columns,
        gridTemplateRows: schema.grid.rows,
        gridTemplateAreas: schema.grid.areas,
        gap: '1px', width: '100%', height: '100%',
      }}>
        {schema.slots.map((slot, i) => {
          const photo = photosById.get(face.photoIds[i])
          return (
            <div key={slot} style={{ gridArea: slot, position: 'relative', overflow: 'hidden', background: '#E4E0D8', minWidth: 0, minHeight: 0 }}>
              {photo && (
                <PixiaImage
                  src={photo.thumbnailUrl || photo.url}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Miniatura liviana de un hero-spread (composition fold) — UNA sola foto que
 * cruza el pliego completo. A tamaño de miniatura no tiene sentido partirla
 * en dos mitades con el lomo al medio (eso es para el tamaño real de página);
 * acá se muestra completa, cubriendo todo el ancho del thumbnail.
 */
export function HeroSpreadThumbnail({ face, photosById }: {
  face: Face
  photosById: Map<string, PhotoAsset>
}) {
  const photo = photosById.get(face.photoIds[0])
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#E4E0D8' }}>
      {photo && (
        <PixiaImage
          src={photo.thumbnailUrl || photo.url}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </div>
  )
}
