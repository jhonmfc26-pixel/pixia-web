import type { AlbumStyle } from '@/core/contracts/AlbumBlueprint'

export default function BlankPage({ style }: { style: AlbumStyle }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: style === 'con-margen' ? '#FAFAF8' : '#0f0f0f',
    }} />
  )
}
