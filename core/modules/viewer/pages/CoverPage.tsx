'use client'
import type { CoverConfig, PhotoAsset, AlbumStyle, AlbumFormat } from '@/core/contracts/AlbumBlueprint'
import CoverRenderer from '@/core/modules/cover/CoverRenderer'

interface CoverPageProps {
  photo?: PhotoAsset
  cover: CoverConfig
  style: AlbumStyle
  format?: AlbumFormat
}

export default function CoverPage({ photo, cover, format }: CoverPageProps) {
  return (
    <CoverRenderer
      config={cover}
      photoUrl={photo?.url}
      photoWidth={photo?.width}
      photoHeight={photo?.height}
      scale={1}
      format={format}
    />
  )
}
