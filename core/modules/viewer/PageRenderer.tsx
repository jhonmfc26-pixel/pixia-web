'use client'
import type { Page, PhotoPlacement } from '@/core/modules/album/types'
import type { PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import LayoutRenderer from './LayoutRenderer'

interface PageRendererProps {
  page: Page
  photosById: Map<string, PhotoAsset>
  placements: Map<string, PhotoPlacement>
  style: AlbumStyle
}

export default function PageRenderer({ page, photosById, placements, style }: PageRendererProps) {
  const schema = getLayoutById(page.layout)
  if (!schema) {
    console.warn('[PageRenderer] Layout no encontrado:', page.layout)
    return <div style={{ width: '100%', height: '100%', background: style === 'con-margen' ? '#FAFAF8' : '#0f0f0f' }} />
  }
  const photos = page.photoIds.map(id => photosById.get(id)).filter(Boolean) as PhotoAsset[]
  return (
    <LayoutRenderer
      schema={schema}
      photos={photos}
      placements={placements}
      style={style}
      spreadHalf={page.spreadHalf}
    />
  )
}
