'use client'
import type { CoverConfig, PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'
import CoverRenderer from '@/core/modules/cover/CoverRenderer'

interface CoverPageProps {
  photo?: PhotoAsset
  cover: CoverConfig
  style: AlbumStyle
}

export default function CoverPage({ photo, cover }: CoverPageProps) {
  return (
    <CoverRenderer
      config={cover}
      photoUrl={photo?.url}
      scale={1}
    />
  )
}
