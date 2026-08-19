'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { BlueprintStatus, OccasionType } from '@/core/contracts/AlbumBlueprint'
import type { PhotoAsset, Spread } from '@/core/contracts/AlbumBlueprint'

interface BlueprintRow {
  id: string
  cover: { photoId: string; title: string }
  spreads: Spread[]
  narrative: { title: string; summary: string; tone: string }
  status: BlueprintStatus
  occasion: OccasionType
  page_count: number
  created_at: string
  updated_at: string
}

function coverImageUrl(row: BlueprintRow): string | null {
  if (!row.cover?.photoId || !Array.isArray(row.spreads)) return null
  const allPhotos: PhotoAsset[] = row.spreads.flatMap(s => s.photos ?? [])
  const photo = allPhotos.find(p => p.id === row.cover.photoId)
  return photo?.thumbnailUrl || photo?.url || null
}

function albumTitle(row: BlueprintRow): string {
  return row.narrative?.title || row.cover?.title || 'Álbum sin título'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function occasionLabel(occasion: OccasionType): string {
  const map: Record<OccasionType, string> = {
    boda: 'Boda', 'bebe-mensual': 'Bebé', viaje: 'Viaje',
    aniversario: 'Aniversario', familia: 'Familia', mascota: 'Mascota',
  }
  return map[occasion] ?? occasion
}

type StatusGroup = 'draft' | 'production' | 'delivered'

function statusGroup(s: BlueprintStatus): StatusGroup {
  if (s === 'shipped' || s === 'delivered') return 'delivered'
  if (s === 'draft' || s === 'preview') return 'draft'
  return 'production'
}

const STATUS_LABEL: Record<StatusGroup, string> = {
  draft: 'Borrador',
  production: 'En producción',
  delivered: 'Entregado',
}

const STATUS_COLOR: Record<StatusGroup, { bg: string; text: string }> = {
  draft:      { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' },
  production: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  delivered:  { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80' },
}

export default function MisAlbumesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [albums, setAlbums] = useState<BlueprintRow[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/')
        return
      }

      setUserEmail(session.user.email ?? null)

      const { data, error } = await supabaseBrowser
        .from('blueprints')
        .select('id, cover, spreads, status, occasion, page_count, created_at, updated_at, narrative')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('[mis-albumes] Error fetching blueprints:', error)
      }

      setAlbums((data ?? []) as BlueprintRow[])
      setLoading(false)
    })
  }, [router])

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut()
    router.replace('/')
  }

  const handleCardClick = (row: BlueprintRow) => {
    const group = statusGroup(row.status)
    if (group === 'draft') {
      router.push(`/checkout/${row.id}`)
    } else {
      router.push(`/book/${row.id}`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff' }}>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px',
      }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 400 }}>
          Tus álbumes
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.push('/create')}
            style={{
              padding: '7px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            + Nuevo álbum
          </button>
          {userEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', color: 'rgba(255,255,255,0.6)',
              }}>
                {userEmail[0].toUpperCase()}
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: '12px', cursor: 'pointer',
                }}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', paddingTop: '80px' }}>
            <div style={{
              width: '28px', height: '28px',
              border: '2px solid rgba(255,255,255,0.12)',
              borderTopColor: 'rgba(255,255,255,0.6)',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>Cargando tus álbumes...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : albums.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <p style={{ fontSize: '40px', marginBottom: '20px' }}>📚</p>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: 400, marginBottom: '12px' }}>
              Aún no has creado ningún álbum
            </h2>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', marginBottom: '32px' }}>
              Tu primer álbum está a unos minutos de distancia.
            </p>
            <button
              onClick={() => router.push('/create')}
              style={{
                padding: '13px 28px',
                background: '#fff', color: '#000',
                border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Crear mi primer álbum
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}>
            {albums.map(row => {
              const imgUrl = coverImageUrl(row)
              const group = statusGroup(row.status)
              const { bg, text: textColor } = STATUS_COLOR[group]
              return (
                <button
                  key={row.id}
                  onClick={() => handleCardClick(row)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  }}
                >
                  {/* Imagen de portada */}
                  <div style={{ width: '100%', aspectRatio: '3/2', background: '#1a1a1a', position: 'relative' }}>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '32px', opacity: 0.15 }}>📷</span>
                      </div>
                    )}
                    {/* Badge de estado */}
                    <div style={{
                      position: 'absolute', top: '10px', right: '10px',
                      padding: '4px 10px', borderRadius: '20px',
                      background: bg, color: textColor,
                      fontSize: '11px', fontWeight: 500,
                    }}>
                      {STATUS_LABEL[group]}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '16px 18px' }}>
                    <p style={{ fontSize: '15px', fontWeight: 500, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>
                      {albumTitle(row)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
                        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                      }}>
                        {occasionLabel(row.occasion)}
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                        {row.page_count || '—'} páginas
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                      {formatDate(row.updated_at)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
