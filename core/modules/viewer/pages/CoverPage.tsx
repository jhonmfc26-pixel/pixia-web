'use client'
import type { CoverConfig, PhotoAsset, AlbumStyle, AlbumFormat } from '@/core/contracts/AlbumBlueprint'
import CoverRenderer from '@/core/modules/cover/CoverRenderer'
import { photoSrc, usePhotoQuality } from '@/core/modules/viewer/PhotoQualityContext'

interface CoverPageProps {
  photo?: PhotoAsset
  cover: CoverConfig
  style: AlbumStyle
  format?: AlbumFormat
}

export default function CoverPage({ photo, cover, format }: CoverPageProps) {
  const quality = usePhotoQuality()
  return (
    <CoverRenderer
      config={cover}
      photoUrl={photoSrc(photo, quality)}
      photoFallbackUrl={photo?.url}
      photoWidth={photo?.width}
      photoHeight={photo?.height}
      format={format}
    />
  )
}
