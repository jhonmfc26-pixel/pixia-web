'use client'
import { LAYOUTS } from '@/core/modules/album/layouts/registry'
import LayoutRenderer from '@/core/modules/viewer/LayoutRenderer'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'

function makePhoto(i: number): PhotoAsset {
  return {
    id: `test-${i}`,
    r2Key: '',
    url: `https://picsum.photos/seed/pixia${i}/800/600`,
    thumbnailUrl: '',
    width: 800,
    height: 600,
    orientation: 'landscape',
    originalName: `test-${i}`,
    score: {
      sharpness: 0, exposure: 0, composition: 0, faces: 0,
      resolution: 0, uniqueness: 0, emotionalWeight: 0,
      finalScore: 0, recommendation: 'supporting',
    },
  }
}

export default function LayoutsDevPage() {
  return (
    <div style={{ padding: 32, background: '#0a0a0a', minHeight: '100vh', color: 'white' }}>
      <h1 style={{ marginBottom: 24, fontFamily: 'serif' }}>Layout Registry — {LAYOUTS.length} layouts</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
        {LAYOUTS.map(schema => {
          // hero-spread: renderizar como vista de spread (2 paneles lado a lado con la misma foto)
          if (schema.scope === 'spread') {
            const photo = makePhoto(0)
            return (
              <div key={schema.id} style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
                  {schema.id} — {schema.name} (vista de spread)
                </div>
                <div style={{ display: 'flex', gap: 2, width: '100%', aspectRatio: '2 / 1' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <LayoutRenderer
                      schema={schema}
                      photos={[photo]}
                      placements={new Map()}
                      style="con-margen"
                      spreadHalf="left"
                    />
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <LayoutRenderer
                      schema={schema}
                      photos={[photo]}
                      placements={new Map()}
                      style="con-margen"
                      spreadHalf="right"
                    />
                  </div>
                </div>
              </div>
            )
          }

          const photos = Array.from({ length: schema.photoCount }, (_, i) => makePhoto(i))
          return (
            <div key={schema.id}>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
                {schema.id} — {schema.name} ({schema.photoCount} fotos)
              </div>
              <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#FAFAF8' }}>
                <LayoutRenderer
                  schema={schema}
                  photos={photos}
                  placements={new Map()}
                  style="con-margen"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
