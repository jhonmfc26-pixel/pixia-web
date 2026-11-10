'use client'

import { formatOfBook, shortSize } from '@/lib/formats'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { orderStage, type OrderStage } from '@/core/modules/album/orderLock'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { listLocalBooks, deleteLocalBook } from '@/core/engine/localBookStorage'
import { draftDaysLeft } from '@/lib/retention'
import { COMMERCIAL } from '@/lib/legal'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import { countRealPages, validateAlbumStructure } from '@/core/modules/foldModel/validate'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
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
  format?: string | null
  structure?: AlbumStructure | null
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
    boda: 'Boda', 'bebe-mensual': 'Niños', viaje: 'Viaje',
    aniversario: 'Aniversario', familia: 'Familia', mascota: 'Mascota',
  }
  return map[occasion] ?? occasion
}

const toIso = (d: unknown): string => {
  const t = d ? new Date(d as string).getTime() : NaN
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString()
}

/** Borradores guardados en este navegador (creados sin iniciar sesión), con la forma de una fila de Supabase. */
async function loadLocalRows(): Promise<BlueprintRow[]> {
  const local = await listLocalBooks().catch(() => [])
  const rows: BlueprintRow[] = []
  for (const { id, book } of local) {
    try {
      const bp = normalizeBook(book, id)
      if (!bp.spreads?.length) continue
      // Borrador vencido (política de 30 días): sus fotos ya se borraron del
      // servidor, así que la copia local tampoco sirve.
      const created = book.createdAt ?? book.identity?.createdAt ?? bp.createdAt
      if (statusGroup(bp.status ?? 'draft') === 'draft' && draftDaysLeft(created, new Date(), COMMERCIAL.draftRetentionDays) <= 0) {
        await deleteLocalBook(id)
        continue
      }
      rows.push({
        id: bp.id || id,
        cover: bp.cover as BlueprintRow['cover'],
        spreads: bp.spreads,
        narrative: bp.narrative as BlueprintRow['narrative'],
        status: bp.status ?? 'draft',
        occasion: bp.occasion,
        page_count: bp.pageCount,
        format: bp.format,
        structure: bp.structure ?? null,
        created_at: toIso(book.createdAt ?? book.identity?.createdAt ?? bp.createdAt),
        updated_at: toIso(book.updatedAt ?? bp.updatedAt ?? book.createdAt),
      })
    } catch { /* álbum local ilegible: se omite */ }
  }
  return rows
}

/**
 * Páginas reales del álbum (las que se imprimen y se cobran), igual que el
 * checkout: la structure guardada si es válida, si no la que arma el motor.
 * page_count de la fila es un conteo viejo de la IA y no coincide.
 */
function realPages(row: BlueprintRow): number | null {
  try {
    if (row.structure && validateAlbumStructure(row.structure).ok) return countRealPages(row.structure)
    const bp = normalizeBook(row as unknown as Record<string, unknown>, row.id)
    return countRealPages(foldsFromBlueprint(bp).structure)
  } catch {
    return row.page_count || null
  }
}

type StatusGroup = 'draft' | OrderStage

function statusGroup(s: BlueprintStatus | string): StatusGroup {
  if (s === 'draft' || s === 'preview') return 'draft'
  return orderStage(s)
}

const STATUS_LABEL: Record<StatusGroup, string> = {
  draft: 'Borrador',
  production: 'Preparando',
  printing: 'En impresión',
  shipped: 'En camino',
  delivered: 'Entregado',
}

const STATUS_COLOR: Record<StatusGroup, { bg: string; text: string }> = {
  draft:      { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' },
  production: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  printing:   { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  shipped:    { bg: 'rgba(56,189,248,0.12)', text: '#7dd3fc' },
  delivered:  { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80' },
}

export default function MisAlbumesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [albums, setAlbums] = useState<BlueprintRow[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  // Sin sesión pero con borradores en este navegador: se listan igual.
  const [localOnly, setLocalOnly] = useState(false)

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      const localRows = await loadLocalRows()
      if (!session) {
        // Quien no ha comprado no tiene cuenta, pero sí sus borradores en este
        // dispositivo: se muestran. Sin nada, se pide el correo (para quien
        // compró en otro dispositivo) o se ofrece crear el primero.
        if (localRows.length > 0) {
          setAlbums(localRows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
          setLocalOnly(true)
        } else {
          setNeedsLogin(true)
        }
        setLoading(false)
        return
      }

      setUserEmail(session.user.email ?? null)

      const { data, error } = await supabaseBrowser
        .from('blueprints')
        .select('id, cover, spreads, status, occasion, format, page_count, structure, created_at, updated_at, narrative')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('[mis-albumes] Error fetching blueprints:', error)
      }

      // Más los borradores de este navegador que todavía no están en la cuenta.
      // Los borradores vencidos los borra la limpieza diaria; mientras tanto no se muestran.
      const remote = ((data ?? []) as BlueprintRow[]).filter(r =>
        statusGroup(r.status) !== 'draft' || draftDaysLeft(r.created_at, new Date(), COMMERCIAL.draftRetentionDays) > 0)
      const remoteIds = new Set(remote.map(r => r.id))
      setAlbums([...remote, ...localRows.filter(r => !remoteIds.has(r.id))]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
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

  if (needsLogin) return <LoginPrompt onCreate={() => router.push('/create')} />

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

        {localOnly && !loading && (
          <div style={{
            marginBottom: '28px', padding: '14px 18px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '13px', lineHeight: 1.55, color: 'rgba(255,255,255,0.65)',
          }}>
            Estos álbumes están guardados en este dispositivo.{' '}
            <button onClick={() => { setLocalOnly(false); setNeedsLogin(true) }}
              style={{ background: 'none', border: 'none', padding: 0, color: '#F08A72', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>
              ¿Compraste un álbum? Entra con tu correo
            </button>{' '}para ver tus pedidos.
          </div>
        )}

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
                        {shortSize(formatOfBook(row.format))} cm · {realPages(row) ?? '—'} páginas
                      </span>
                    </div>
                    {group === 'draft' ? (() => {
                      // Contador de la política de conservación: un borrador se guarda
                      // (y se puede editar) 30 días desde que se creó.
                      const left = draftDaysLeft(row.created_at, new Date(), COMMERCIAL.draftRetentionDays)
                      const soon = left <= 7
                      return (
                        <p style={{ fontSize: '11px', color: soon ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                          {left <= 1 ? 'Se borra mañana' : `Se borra en ${left} días`} si no lo compras · creado el {formatDate(row.created_at)}
                        </p>
                      )
                    })() : (
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                        {formatDate(row.updated_at)}
                      </p>
                    )}
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

/** Entrar con un enlace al correo (el mismo login del checkout). */
function LoginPrompt({ onCreate }: { onCreate: () => void }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'unknown'>('idle')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setState('error'); return }
    setState('sending')
    try { localStorage.setItem('pixia_auth_next', '/mis-albumes') } catch { /* no importa */ }
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
    })
    // Con shouldCreateUser:false, un correo sin cuenta (nunca compró) da error
    // de "signups not allowed": no es una falla, es que no hay álbumes ahí.
    if (error && /signup|not allowed|not found/i.test(error.message)) { setState('unknown'); return }
    setState(error ? 'error' : 'sent')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 text-white">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="font-[family-name:var(--font-display)] text-xl text-white/80">Pixia</Link>
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-normal">Tus álbumes</h1>
        {state === 'sent' ? (
          <p className="mt-4 leading-relaxed text-white/65">
            Te enviamos un enlace a <span className="text-white">{email.trim()}</span>. Ábrelo en este mismo dispositivo para entrar.
          </p>
        ) : (
          <>
            <p className="mt-3 text-white/60">Escribe el correo con el que hiciste tu pedido y te enviamos un enlace para entrar.</p>
            <form onSubmit={send} className="mt-8 space-y-3">
              <input type="email" inputMode="email" autoComplete="email" required value={email}
                onChange={e => { setEmail(e.target.value); if (state === 'error' || state === 'unknown') setState('idle') }}
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white outline-none placeholder:text-white/30 focus:border-[var(--brand-coral)]" />
              <button type="submit" disabled={state === 'sending'}
                className="w-full rounded-xl bg-[var(--brand-coral)] px-6 py-3.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60">
                {state === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
              </button>
              <p className="text-xs leading-relaxed text-white/40">
                Usamos tu correo solo para tu cuenta y tus pedidos, según nuestra <Link href="/privacidad" className="underline">Política de datos personales</Link>.
              </p>
              {state === 'error' && (
                <p className="text-sm text-[#F08A72]">No pudimos enviar el enlace. Revisa el correo (debe ser el de tu pedido) e inténtalo de nuevo.</p>
              )}
              {state === 'unknown' && (
                <p className="text-sm text-[#F08A72]">No encontramos pedidos con ese correo. Revisa que sea el mismo con el que compraste.</p>
              )}
            </form>
          </>
        )}

        {/* Quien todavía no tiene álbumes: crear el primero (Jhon, 2026-11-09). */}
        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="text-sm text-white/55">¿Todavía no tienes álbumes?</p>
          <button type="button" onClick={onCreate}
            className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 font-medium text-white transition hover:bg-white/[0.08]">
            Crear mi primer álbum
          </button>
        </div>
      </div>
    </main>
  )
}
