'use client'

export const runtime = 'edge'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import type { AlbumBlueprint, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import type { AlbumStructure, Face } from '@/core/modules/foldModel/types'
import { changeFaceLayout, featurePhoto, removePhoto, addPhotoToFace, replacePhotoFromBag, MAX_FACE_PHOTOS } from '@/core/modules/foldModel/mutations'
import { getBag } from '@/core/modules/foldModel/getBag'
import type { LayoutId } from '@/core/modules/album/layouts/registry'
import { validateAlbumStructure } from '@/core/modules/foldModel/validateStructure'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Crop, LayoutGrid, Plus, RefreshCw, Star, Trash2, Upload } from 'lucide-react'
import { LAYOUTS } from '@/core/modules/album/layouts/registry'
import FoldStructureViewer from '@/core/modules/foldModel/render/FoldStructureViewer'
import type { SelState } from '@/core/modules/foldModel/render/selectionTypes'
import { normalizeFiles } from '@/core/modules/upload/normalizeFiles'
import { hashFileContent } from '@/core/modules/upload/contentHash'
import { usePhotoAnalysis } from '@/core/modules/scoring/usePhotoAnalysis'
import { useUpload } from '@/core/modules/upload/useUpload'
import { useSession } from '@/core/modules/session/useSession'

// Mismo chequeo de magic bytes que Step2Upload — el pipeline solo acepta
// jpeg/png/webp reales, sin confiar en la extensión del archivo.
type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown'

async function detectImageFormat(file: File): Promise<ImageFormat> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer()
    const b = new Uint8Array(buffer)
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg'
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png'
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase()
      if (['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif'].some(t => brand.startsWith(t))) return 'heic'
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

// ── Popover contextual ────────────────────────────────────────────────────────

const PHOTO_ACTIONS = [
  { id: 'reframe',   label: 'Reencuadrar', Icon: Crop      },
  { id: 'replace',   label: 'Cambiar',     Icon: RefreshCw },
  { id: 'highlight', label: 'Destacar',    Icon: Star      },
  { id: 'remove',    label: 'Quitar',      Icon: Trash2    },
] as const

const CHROM: React.CSSProperties = {
  background: '#1b1b1b',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '11px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.35)',
  overflow: 'hidden',
  animation: 'pixia-pop-in 0.14s ease both',
}

const BTN_ICON: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '4px', padding: '8px 10px', border: 'none', borderRadius: '8px',
  background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)',
  cursor: 'pointer', flexShrink: 0, transition: 'color 0.12s, background 0.12s',
}

function ThumbLayout({ schema, isActive, onClick }: {
  schema: typeof LAYOUTS[number]
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '4px', padding: '5px 7px', border: 'none', flexShrink: 0,
        borderRadius: '7px', cursor: 'pointer',
        background: isActive ? 'rgba(232,85,58,0.12)' : 'transparent',
        boxShadow: isActive ? 'inset 0 0 0 1.5px #E8553A' : 'none',
        transition: 'background 0.12s, box-shadow 0.12s',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: schema.grid.columns,
        gridTemplateRows: schema.grid.rows,
        gridTemplateAreas: schema.grid.areas,
        gap: '2px', width: '44px', height: '34px',
      }}>
        {schema.slots.map(slot => (
          <div key={slot} style={{
            gridArea: slot, borderRadius: '1px',
            background: isActive ? '#E8553A' : 'rgba(255,255,255,0.22)',
            transition: 'background 0.12s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: '8px', color: isActive ? '#E8553A' : 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>
        {schema.name}
      </span>
    </button>
  )
}

/** Botón "Subir nueva foto" — usado en el panel de Cambiar y en el de Agregar. */
function UploadNewPhotoButton({ uploading, uploadCount, onClick }: { uploading: boolean; uploadCount: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={uploading}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        padding: '14px', marginBottom: '18px',
        border: '1.5px dashed rgba(255,255,255,0.18)', borderRadius: '10px',
        background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.45)',
        fontSize: '13px', cursor: uploading ? 'default' : 'pointer', transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!uploading) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
    >
      {uploading ? (
        <>
          <span style={{
            width: '14px', height: '14px', flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.15)', borderTopColor: 'rgba(255,255,255,0.6)',
            borderRadius: '50%', animation: 'pixia-spin 0.7s linear infinite',
          }} />
          {uploadCount > 1 ? `Subiendo ${uploadCount} fotos...` : 'Subiendo foto...'}
        </>
      ) : (
        <>
          <Upload size={15} strokeWidth={1.5} />
          Subir nueva foto
        </>
      )}
    </button>
  )
}

/**
 * Popover de acciones de FOTO — flota sobre/bajo la foto seleccionada.
 * Altura fija (~64px): el mismo contenido siempre, sin necesidad de medir.
 * Posicionamiento robusto: prefiere arriba; si no cabe, abajo; si tampoco,
 * se clampea al lado con más espacio, nunca sale del viewport.
 */
function PhotoActionsPopover({ photoId, anchorRect, photoFace, onAction }: {
  photoId: string
  anchorRect: DOMRect
  photoFace: Face | null
  onAction: (action: string, id: string) => void
}) {
  const TOP_BAR = 56
  const H = 64   // altura fija (icon + gap + label + padding × 2 = ~64px)
  const GAP = 8

  const spaceAbove = anchorRect.top - TOP_BAR - GAP
  const spaceBelow = window.innerHeight - anchorRect.bottom - GAP

  let rawTop: number
  if (spaceAbove >= H) {
    rawTop = anchorRect.top - GAP - H          // cabe arriba → arriba
  } else if (spaceBelow >= H) {
    rawTop = anchorRect.bottom + GAP           // cabe abajo → abajo
  } else if (spaceAbove >= spaceBelow) {
    rawTop = anchorRect.top - GAP - H          // más espacio arriba → arriba clampeado
  } else {
    rawTop = anchorRect.bottom + GAP           // más espacio abajo → abajo clampeado
  }
  const top = Math.min(window.innerHeight - H - GAP, Math.max(TOP_BAR + GAP, rawTop))

  const centerX = anchorRect.left + anchorRect.width / 2
  const left = Math.max(20, Math.min(centerX, window.innerWidth - 20))

  // Cupo disponible en la cara de la foto seleccionada — "Agregar" solo
  // tiene sentido si aún caben más fotos ahí (misma regla que FaceDesignPanel).
  const canAddToFace = !!photoFace && photoFace.photoIds.length < MAX_FACE_PHOTOS

  return (
    <div style={{ position: 'fixed', left: `${left}px`, top: `${top}px`, transform: 'translateX(-50%)', zIndex: 120, maxWidth: 'calc(100vw - 32px)' }}>
      <div style={CHROM}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', padding: '8px 4px' }}>
            {PHOTO_ACTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onAction(id, photoId)}
                style={BTN_ICON}
                onMouseEnter={e => { e.currentTarget.style.color = '#E8553A'; e.currentTarget.style.background = 'rgba(232,85,58,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            ))}
            {canAddToFace && (
              <button
                onClick={() => onAction('open-bag', photoFace!.id)}
                style={BTN_ICON}
                onMouseEnter={e => { e.currentTarget.style.color = '#E8553A'; e.currentTarget.style.background = 'rgba(232,85,58,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >
                <Plus size={16} strokeWidth={1.5} />
                <span style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>Agregar</span>
              </button>
            )}
          </div>
          {photoFace && (
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.10)', margin: '10px 0', flexShrink: 0 }} />
              <div style={{ padding: '8px 4px' }}>
                <button
                  onClick={() => onAction('select-face', photoFace.id)}
                  style={BTN_ICON}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E8553A'; e.currentTarget.style.background = 'rgba(232,85,58,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                >
                  <LayoutGrid size={16} strokeWidth={1.5} />
                  <span style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>Diseño</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Panel de DISEÑO de cara — posición FIJA (bottom-center, encima de la barra
 * de navegación). No depende de la posición de la foto: acciones de página,
 * no de foto. Nunca clipea independientemente de dónde esté la foto.
 * La tira de layouts es scrollable horizontalmente si hay muchos.
 */
function FaceDesignPanel({ selectedFace, onAction }: {
  selectedFace: Face
  onAction: (action: string, id: string) => void
}) {
  const faceLayouts = LAYOUTS.filter(
    l => l.photoCount === selectedFace.photoIds.length && l.scope !== 'spread'
  )

  return (
    <div style={{
      position: 'fixed',
      bottom: '72px',    // encima de la barra de navegación (64px) + 8px gap
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 120,
      maxWidth: 'min(calc(100vw - 32px), 480px)',
      width: 'max-content',
    }}>
      <div style={CHROM}>
        {selectedFace.isEmpty ? (
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Página vacía
            </div>
            <button
              onClick={() => onAction('open-bag', selectedFace.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', border: 'none', borderRadius: '7px',
                background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
                fontSize: '12px', cursor: 'pointer', transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,85,58,0.12)'; e.currentTarget.style.color = '#E8553A' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            >
              <LayoutGrid size={13} strokeWidth={1.5} />
              Agregar foto desde bolsa
            </button>
          </div>
        ) : (
          <div style={{ padding: '10px 10px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                Diseño · {selectedFace.photoIds.length} foto{selectedFace.photoIds.length !== 1 ? 's' : ''}
              </span>
              {selectedFace.photoIds.length < 5 && (
                <button
                  onClick={() => onAction('open-bag', selectedFace.id)}
                  style={{ background: 'none', border: 'none', padding: '0', color: 'rgba(255,255,255,0.38)', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E8553A' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)' }}
                >
                  + Agregar
                </button>
              )}
            </div>
            {/* Tira scrollable: nunca desborda verticalmente */}
            <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
              {faceLayouts.map(schema => (
                <ThumbLayout
                  key={schema.id}
                  schema={schema}
                  isActive={schema.id === selectedFace.layout}
                  onClick={() => onAction('change-layout', schema.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectBlueprintPhotoIds(book: AlbumBlueprint): Set<string> {
  const ids = new Set<string>()
  for (const spread of book.spreads) {
    for (const photo of spread.photos) ids.add(photo.id)
  }
  return ids
}

/**
 * Pantalla bloqueante cuando no hay sesión activa — edit-v2 exige login para
 * evitar que el usuario edite "a ciegas" creyendo que guarda en la nube
 * cuando en realidad caería en silencio al fallback de localStorage.
 * Magic link vía signInWithOtp, mismo mecanismo que checkout. Reutiliza la
 * clave `pixia_pending_checkout` a propósito: auth/callback ya sabe leerla,
 * sincronizar el book local a Supabase y volver a `returnTo` — sin tocar
 * auth/callback, el usuario vuelve derecho a este editor tras loguearse.
 */
function LoginRequiredScreen({ bookId }: { bookId: string }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMagicLink = async () => {
    if (!email.trim() || sending) return
    setSending(true)
    setError(null)
    const { error: otpError } = await supabaseBrowser.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })
    setSending(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    setSent(true)
    localStorage.setItem('pixia_pending_checkout', JSON.stringify({
      bookId,
      returnTo: `${window.location.pathname}${window.location.search}`,
    }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0f0f0f', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px', textAlign: 'center',
    }}>
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 400, fontSize: '22px', marginBottom: '10px' }}>
          Debes iniciar sesión para editar tu álbum
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '28px' }}>
          Sin sesión, tus cambios no se guardan en la nube. Inicia sesión para editar con la seguridad de que todo persiste.
        </p>

        {!sent ? (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMagicLink() }}
              placeholder="tu@correo.com"
              style={{
                width: '100%', padding: '12px 14px', marginBottom: '12px', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none',
              }}
            />
            {error && (
              <div style={{
                padding: '10px 14px', marginBottom: '12px',
                background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)',
                borderRadius: '6px', color: '#ff8080', fontSize: '13px',
              }}>
                {error}
              </div>
            )}
            <button
              onClick={sendMagicLink}
              disabled={sending || !email.trim()}
              style={{
                width: '100%', padding: '13px',
                background: sending || !email.trim() ? 'rgba(232,85,58,0.4)' : '#E8553A',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: 600,
                cursor: sending || !email.trim() ? 'default' : 'pointer',
              }}
            >
              {sending ? 'Enviando...' : 'Enviar enlace de acceso'}
            </button>
          </>
        ) : (
          <div>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📬</div>
            <p style={{ fontSize: '14px', color: '#fff', marginBottom: '8px', fontWeight: 500 }}>Revisa tu correo</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Te enviamos un enlace a <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{email}</strong>. Ábrelo para volver directo a tu edición.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditV2Page() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string

  const [book, setBookState] = useState<AlbumBlueprint | null>(null)
  // Espejo síncrono de `book` — uploadNewPhoto hace setBook(prev => ...) tras
  // cada subida, y ese setState se aplica en un render posterior (asíncrono).
  // handleDone necesita el book MÁS RECIENTE al momento de guardar, no el que
  // quedó cerrado en su closure si el usuario pulsa "Listo" antes de que React
  // termine de re-renderizar — bookRef.current siempre está al día porque se
  // actualiza en el mismo tick que se llama a setBook.
  const bookRef = useRef<AlbumBlueprint | null>(null)
  const setBook = (updater: React.SetStateAction<AlbumBlueprint | null>) => {
    setBookState(prev => {
      const next = typeof updater === 'function'
        ? (updater as (p: AlbumBlueprint | null) => AlbumBlueprint | null)(prev)
        : updater
      bookRef.current = next
      return next
    })
  }

  // ── Sesión activa — edit-v2 la EXIGE, no opera "a ciegas" sin ella ────────
  // Antes: sin sesión, handleDone caía en silencio a localStorage y mostraba
  // "Guardado" igual — el usuario perdía su trabajo sin ningún aviso. Ahora
  // se bloquea la edición por completo hasta confirmar sesión.
  const [authChecked, setAuthChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setHasSession(!!session)
      setAuthChecked(true)
    })
    return () => { cancelled = true }
  }, [])

  // ── Subir foto nueva — mismo pipeline que la carga inicial (create flow) ──
  const { analyzePhotos } = usePhotoAnalysis()
  const { sessionId } = useSession()
  const { uploadPhotos } = useUpload(sessionId || '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Posición compartida con el viewer: portada = 0, primer pliego interior = 1,
  // etc. El editor no tiene vista de portada, así que ?spread=N cae en el
  // fold N-1 (y ?spread=0 → primer fold, no hay a dónde más ir).
  const [currentFold, setCurrentFold] = useState(() => {
    const raw = parseInt(searchParams.get('spread') ?? '', 10)
    return Number.isFinite(raw) ? Math.max(0, raw - 1) : 0
  })

  useEffect(() => {
    // Sin sesión confirmada, no hay nada que cargar — LoginRequiredScreen
    // toma el control del render (ver más abajo).
    if (!authChecked || !hasSession) return

    async function loadBook() {
      // 1. Intentar desde Supabase (ya sabemos que hay sesión activa)
      try {
        const { data, error } = await supabaseBrowser
          .from('blueprints')
          .select('*')
          .eq('id', id)
          .single()
        if (!error && data) {
          setBook(normalizeBook(data, id))
          return
        }
        if (error) console.warn('[EditV2] Supabase load:', error.message)
      } catch (e) {
        console.warn('[EditV2] No se pudo cargar desde Supabase:', e)
      }

      // 2. Fallback de EMERGENCIA: localStorage, solo si la fila de Supabase
      // falló pese a haber sesión (red caída, fila inexistente, etc.) — no
      // sustituye la sesión, que ya está confirmada en este punto.
      try {
        const raw = localStorage.getItem('pixia_books')
        if (!raw) return
        const books = JSON.parse(raw)
        const b = books[id]
        if (!b) return
        setBook(normalizeBook(b, id))
      } catch (err) {
        console.error('[EditV2] Error normalizando book:', err)
      }
    }
    loadBook()
  }, [id, authChecked, hasSession])

  // ── Estructura — inicializada una vez cuando carga el book ─────────────────
  const structureInitialized = useRef(false)
  const [structure, setStructureState] = useState<AlbumStructure | null>(null)
  // Mismo patrón que bookRef: handleDone necesita la structure más reciente,
  // no una cerrada en un closure viejo (ver comentario en bookRef arriba).
  const structureRef = useRef<AlbumStructure | null>(null)
  const setStructure = (updater: React.SetStateAction<AlbumStructure | null>) => {
    setStructureState(prev => {
      const next = typeof updater === 'function'
        ? (updater as (p: AlbumStructure | null) => AlbumStructure | null)(prev)
        : updater
      structureRef.current = next
      return next
    })
  }
  const [problems, setProblems] = useState<string[]>([])

  useEffect(() => {
    if (!book || structureInitialized.current) return
    structureInitialized.current = true

    // 1. Intentar cargar estructura guardada del editor v2
    if (book.structure) {
      const knownIds = collectBlueprintPhotoIds(book)
      const validation = validateAlbumStructure(book.structure, knownIds)
      if (validation.ok) {
        console.log('[EditV2] Estructura restaurada')
        setStructure(book.structure)
        setProblems([])
        return
      }
      console.warn('[EditV2] Estructura guardada descartada:', validation.reason)
    }

    // 2. Fallback: derivar desde el blueprint (álbum nuevo o estructura inválida)
    const { structure: s, problems: p } = foldsFromBlueprint(book)
    setStructure(s)
    setProblems(p)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book])

  // ── Mapa de fotos ───────────────────────────────────────────────────────────
  const photosById = useMemo(() => {
    if (!book) return new Map<string, PhotoAsset>()
    const map = new Map<string, PhotoAsset>()
    const seen = new Set<string>()
    for (const spread of book.spreads) {
      for (const photo of spread.photos) {
        if (!seen.has(photo.id)) { seen.add(photo.id); map.set(photo.id, photo) }
      }
    }
    return map
  }, [book])

  // ── Bolsa derivada ──────────────────────────────────────────────────────────
  const [bagOpen, setBagOpen] = useState(false)
  const [bagTargetFaceId, setBagTargetFaceId] = useState<string | null>(null)
  // Selección múltiple pendiente de confirmar — se agregan todas EN ORDEN al
  // pulsar "Agregar". Un array (no Set) porque el orden importa: afecta qué
  // slot ocupa cada foto cuando el layout elegido tiene un slot dominante.
  const [bagSelected, setBagSelected] = useState<string[]>([])

  // ── Cambiar foto (reemplazo en la misma posición, desde la bolsa) ─────────
  const [replaceTarget, setReplaceTarget] = useState<{ faceId: string; oldPhotoId: string } | null>(null)

  const bagPhotos = useMemo(() => {
    if (!structure) return []
    return getBag(structure, [...photosById.values()])
  }, [structure, photosById])

  // Cara destino de "Agregar" y su cupo actual (5 − fotos que ya tiene; un
  // hueco vacío parte de 5). Cambiar es siempre 1:1 — no usa este cupo.
  const bagTargetFace = useMemo((): Face | null => {
    if (!structure || !bagTargetFaceId) return null
    for (const fold of structure.folds) {
      if (fold.kind === 'paired') {
        if (fold.left.id  === bagTargetFaceId) return fold.left
        if (fold.right.id === bagTargetFaceId) return fold.right
      } else {
        if (fold.face.id === bagTargetFaceId) return fold.face
      }
    }
    return null
  }, [structure, bagTargetFaceId])

  const bagCapacity = bagTargetFace
    ? (bagTargetFace.isEmpty ? MAX_FACE_PHOTOS : Math.max(0, MAX_FACE_PHOTOS - bagTargetFace.photoIds.length))
    : MAX_FACE_PHOTOS

  // ── Selección + ancla para popover ──────────────────────────────────────────
  const [sel, setSel] = useState<SelState>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const handleSel = (next: SelState, rect?: DOMRect) => {
    setSel(next)
    if (next === null) setAnchorRect(null)
    else if (rect) setAnchorRect(rect)
  }

  const selectedFace = useMemo((): Face | null => {
    if (!structure || sel?.type !== 'face') return null
    for (const fold of structure.folds) {
      if (fold.kind === 'paired') {
        if (fold.left.id  === sel.id) return fold.left
        if (fold.right.id === sel.id) return fold.right
      } else {
        if (fold.face.id === sel.id) return fold.face
      }
    }
    return null
  }, [structure, sel])

  // Cara que contiene la foto seleccionada (para el botón "Diseño" en modo foto)
  const photoFace = useMemo((): Face | null => {
    if (!structure || sel?.type !== 'photo') return null
    for (const fold of structure.folds) {
      if (fold.kind === 'paired') {
        if (fold.left.photoIds.includes(sel.id)) return fold.left
        if (fold.right.photoIds.includes(sel.id)) return fold.right
      } else {
        if (fold.face.photoIds.includes(sel.id)) return fold.face
      }
    }
    return null
  }, [structure, sel])

  // ── Toast (acciones + guardado) ────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function showToast(msg: string, isError = false, durationMs = 2200) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, isError })
    toastTimer.current = setTimeout(() => setToast(null), durationMs)
  }

  // ── Guardar estructura al presionar "Listo" ────────────────────────────────
  const handleDone = async () => {
    // Leer de los refs, no del closure de state: si el usuario pulsa "Listo"
    // justo después de subir una foto, el setBook/setStructure de esa subida
    // puede no haberse aplicado todavía en el `book`/`structure` cerrados en
    // este render — bookRef/structureRef están siempre al día (ver comentarios
    // en su declaración). Guardar con la versión vieja sería guardar una
    // structure que referencia una foto que el blueprint enviado no tiene.
    const currentBook = bookRef.current
    const currentStructure = structureRef.current
    if (!currentStructure || !currentBook || isSaving) return

    // Validar antes de persistir — nunca guardar una estructura rota. Se
    // mantiene sin relajar: sigue siendo la garantía de que nunca se persiste
    // una foto en structure que no exista en el blueprint.
    const validation = validateAlbumStructure(currentStructure)
    if (!validation.ok) {
      showToast(`No se puede guardar: ${validation.reason}`, true, 4000)
      return
    }

    setIsSaving(true)
    // finally garantiza el reset de isSaving pase lo que pase (éxito, error o
    // excepción no prevista) — antes solo se reseteaba en la rama de error,
    // así que un guardado exitoso dejaba el botón "Guardando…" pegado para
    // siempre y los clicks posteriores cortaban en el guard de arriba sin
    // dejar rastro.
    try {
      // La sesión pudo expirar mientras el usuario editaba — verificar ACÁ,
      // no asumir que sigue siendo válida solo porque LoginRequiredScreen no
      // se mostró al montar. Sin sesión, NO hay fallback silencioso a
      // localStorage: eso es exactamente lo que hacía perder el trabajo del
      // usuario sin ningún aviso.
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        setHasSession(false)
        showToast('Tu sesión expiró — inicia sesión de nuevo para guardar tus cambios', true, 5000)
        return
      }

      let savedOk = false

      // Intentar guardar en Supabase vía API (service_role) — el cliente del
      // navegador NO tiene política UPDATE sobre `blueprints` (RLS solo permite
      // SELECT a authenticated; ver supabase/policies.sql), así que un
      // `supabaseBrowser.update()` directo es un no-op silencioso: no falla,
      // pero tampoco escribe nada. /api/blueprints/persist usa supabaseAdmin
      // (bypassa RLS) y persiste structure + spreads (fotos nuevas incluidas)
      // en un solo upsert — mismo mecanismo que auth/callback.
      try {
        const res = await fetch('/api/blueprints/persist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ blueprint: { ...currentBook, structure: currentStructure }, sessionId: sessionId ?? '' }),
        })
        if (res.ok) {
          savedOk = true
          console.log('[EditV2] Blueprint guardado en Supabase (structure + spreads)')
        } else {
          const errText = await res.text().catch(() => 'unknown')
          console.warn('[EditV2] /api/blueprints/persist:', res.status, errText)
        }
      } catch (e) {
        console.warn('[EditV2] No se pudo guardar en Supabase:', e)
      }

      // Red de EMERGENCIA: solo llega acá con sesión válida confirmada arriba
      // (Supabase caído, red, etc.) — nunca como sustituto de sesión ausente.
      if (!savedOk) {
        try {
          const raw = localStorage.getItem('pixia_books')
          const books = raw ? JSON.parse(raw) : {}
          books[id] = { ...books[id], structure: currentStructure, spreads: currentBook.spreads }
          localStorage.setItem('pixia_books', JSON.stringify(books))
          savedOk = true
          console.log('[EditV2] Estructura guardada en localStorage (fallback de emergencia — Supabase falló con sesión válida)')
        } catch (e) {
          console.error('[EditV2] Error guardando en localStorage:', e)
        }
      }

      if (savedOk) {
        showToast('Guardado', false, 1200)
        // De vuelta a la numeración compartida con el viewer (portada = 0).
        setTimeout(() => { window.location.href = `/book/${id}?spread=${currentFold + 1}` }, 1000)
      } else {
        showToast('No se pudo guardar, reintenta', true, 4000)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // ── Acciones del editor ────────────────────────────────────────────────────
  const handleAction = (action: string, targetId: string) => {
    if (action === 'change-layout') {
      if (!sel || sel.type !== 'face') return
      setStructure(prev => prev ? changeFaceLayout(prev, sel.id, targetId as LayoutId) : prev)
      return
    }
    if (action === 'select-face') {
      setSel({ type: 'face', id: targetId })
      return
    }
    if (action === 'highlight') {
      if (!structure || !photoFace) return
      if (photoFace.photoIds[0] === targetId) {
        showToast('Ya es la foto principal')
        return
      }
      setStructure(prev => prev ? featurePhoto(prev, photoFace.id, targetId) : prev)
      showToast('Foto destacada')
      return
    }
    if (action === 'remove') {
      if (!structure || !photoFace) return
      const getAR = (pid: string) => {
        const p = photosById.get(pid)
        return p && p.width && p.height ? p.width / p.height : 1.0
      }
      setStructure(prev => prev ? removePhoto(prev, photoFace.id, targetId, getAR) : prev)
      setSel(null)
      setAnchorRect(null)
      showToast('Movida a tu bolsa')
      return
    }
    if (action === 'open-bag') {
      setBagTargetFaceId(targetId)
      setBagSelected([])
      setBagOpen(true)
      return
    }
    if (action === 'replace') {
      if (!photoFace) return
      setReplaceTarget({ faceId: photoFace.id, oldPhotoId: targetId })
      return
    }
    const msg = `[${action}] ${targetId}`
    console.log('[EditV2 placeholder]', msg)
    showToast(msg)
  }

  // ── Agregar desde bolsa (selección múltiple hasta el cupo) ─────────────────
  // Tocar una miniatura la marca/desmarca; no agrega de inmediato. Al llegar
  // al cupo, las no seleccionadas quedan deshabilitadas (ver bagCapacity).
  const toggleBagSelected = (photoId: string) => {
    setBagSelected(prev => {
      if (prev.includes(photoId)) return prev.filter(id => id !== photoId)
      if (prev.length >= bagCapacity) return prev // cupo alcanzado — no-op
      return [...prev, photoId]
    })
  }

  // Agrega todas las seleccionadas EN ORDEN — addPhotoToFace re-elige layout
  // en cada paso, así que el resultado final ya queda ajustado al conteo total.
  const handleConfirmAddFromBag = () => {
    if (!structure || !bagTargetFaceId || bagSelected.length === 0) return
    const getAR = (pid: string) => {
      const p = photosById.get(pid)
      return p && p.width && p.height ? p.width / p.height : 1.0
    }
    const newStructure = bagSelected.reduce(
      (acc, photoId) => addPhotoToFace(acc, bagTargetFaceId, photoId, getAR),
      structure,
    )
    setStructure(newStructure)
    showToast(bagSelected.length === 1 ? 'Foto agregada' : `${bagSelected.length} fotos agregadas`)
    setBagSelected([])
    setBagOpen(false)
  }

  // ── Cambiar foto desde bolsa (reemplazo en la misma posición) ─────────────
  const handleReplaceFromBag = (newPhotoId: string) => {
    if (!structure || !replaceTarget) return
    const newStructure = replacePhotoFromBag(structure, replaceTarget.faceId, replaceTarget.oldPhotoId, newPhotoId)
    setStructure(newStructure)
    setReplaceTarget(null)
    setSel(null)
    setAnchorRect(null)
    showToast('Foto cambiada')
  }

  // ── Subir foto nueva ────────────────────────────────────────────────────────
  // Mismo pipeline que el upload inicial (Step2Upload): normalizeFiles (HEIC→JPEG,
  // EXIF preservado) → detección de formato real por magic bytes → análisis
  // (score/orientación/dimensiones vía usePhotoAnalysis) → subida a R2 (useUpload).
  // Construye el PhotoAsset resultante y lo agrega al pool de fotos del blueprint
  // (book.spreads) como un spread de una sola foto — no hay precedente de "agregar
  // foto" previo a esto, así que photosById (derivado de book.spreads) la recoge
  // automáticamente en el próximo render.
  const uploadNewPhoto = async (file: File, contentHash: string): Promise<PhotoAsset | null> => {
    try {
      const { files: normalized, failed } = await normalizeFiles([file])
      if (failed.length > 0 || normalized.length === 0) {
        showToast('No pudimos procesar esa foto', true, 4000)
        return null
      }
      const { file: normFile, heicExif } = normalized[0]

      const fmt = await detectImageFormat(normFile)
      if (fmt !== 'jpeg' && fmt !== 'png' && fmt !== 'webp') {
        showToast('Formato no soportado — usa JPG, PNG, WebP o HEIC', true, 4000)
        return null
      }

      if (!sessionId) {
        showToast('Sesión no disponible, reintenta', true, 4000)
        return null
      }

      const [analyzed] = await analyzePhotos([normFile])
      if (!analyzed) {
        showToast('No pudimos analizar esa foto', true, 4000)
        return null
      }

      const photoId = analyzed.id
      const uploaded = await uploadPhotos([{ file: normFile, photoId }])
      if (uploaded.length === 0) {
        showToast('No se pudo subir la foto, reintenta', true, 4000)
        return null
      }
      const up = uploaded[0]

      // La conversión HEIC→JPEG descarta el EXIF — usar el extraído del original.
      const takenAt = heicExif?.takenAt ?? analyzed.exif.takenAt ?? null
      const gps =
        heicExif?.lat != null && heicExif?.lng != null
          ? { lat: heicExif.lat, lng: heicExif.lng }
          : analyzed.exif.lat != null && analyzed.exif.lng != null
            ? { lat: analyzed.exif.lat, lng: analyzed.exif.lng }
            : undefined

      const newPhoto: PhotoAsset = {
        id: photoId,
        r2Key: up.r2Key,
        url: up.url,
        thumbnailUrl: up.thumbnailUrl,
        width: analyzed.width,
        height: analyzed.height,
        orientation: analyzed.orientation,
        // PhotoScore de usePhotoAnalysis no trae uniqueness/emotionalWeight —
        // mismo default que normalizeBook.ts aplica en el resto del álbum.
        score: { ...analyzed.score, uniqueness: 100, emotionalWeight: 50 },
        takenAt,
        gps,
        originalName: file.name,
        meaningRegions: analyzed.meaningRegions,
        contentHash,
      }

      setBook(prev => {
        if (!prev) return prev
        const newSpread = {
          id: `spread-upload-${photoId}`,
          act: 'desarrollo' as const,
          layout: 'single' as LayoutId,
          photos: [newPhoto],
          isLocked: false,
          pageNumber: prev.spreads.length,
        }
        return { ...prev, spreads: [...prev.spreads, newSpread] }
      })

      return newPhoto
    } catch (e) {
      console.error('[EditV2] Error subiendo foto:', e)
      showToast('No se pudo subir la foto, reintenta', true, 4000)
      return null
    }
  }

  // Dispara el <input type="file"> oculto compartido; al elegir archivo(s),
  // el destino (Cambiar vs Agregar) se decide según qué panel esté abierto.
  // Cambiar es siempre 1:1 (cupo=1 por definición) — el input se abre sin
  // `multiple` en ese caso, así que files[] nunca trae más de uno ahí.
  // Agregar acepta varios a la vez, acotados al cupo actual de la cara.
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // permite re-elegir el/los mismo(s) archivo(s) más tarde
    if (files.length === 0) return

    // Deduplicar por contenido (SHA-256) contra el álbum completo (caras + bolsa)
    // y dentro del propio lote elegido — regla: cero fotos repetidas.
    const albumByHash = new Map<string, PhotoAsset>()
    for (const p of photosById.values()) if (p.contentHash) albumByHash.set(p.contentHash, p)
    const isInBag = (photoId: string) => bagPhotos.some(p => p.id === photoId)

    if (replaceTarget) {
      setUploadingPhoto(true)
      setUploadCount(1)
      try {
        const hash = await hashFileContent(files[0])
        const existing = albumByHash.get(hash)

        let newPhotoId: string
        if (existing) {
          if (existing.id === replaceTarget.oldPhotoId) {
            showToast('Ya tienes esta foto, no la subimos de nuevo.')
            return
          }
          if (!isInBag(existing.id)) {
            showToast('Esta foto ya está en tu álbum.', false, 3000)
            return
          }
          newPhotoId = existing.id
        } else {
          const newPhoto = await uploadNewPhoto(files[0], hash)
          if (!newPhoto) return
          newPhotoId = newPhoto.id
        }

        if (!structure) return
        const newStructure = replacePhotoFromBag(structure, replaceTarget.faceId, replaceTarget.oldPhotoId, newPhotoId)
        setStructure(newStructure)
        setReplaceTarget(null)
        setSel(null)
        setAnchorRect(null)
        showToast(existing ? 'Ya tienes esta foto, no la subimos de nuevo.' : 'Foto cambiada')
      } finally {
        setUploadingPhoto(false)
      }
      return
    }

    if (bagTargetFaceId) {
      setUploadingPhoto(true)
      setUploadCount(files.length)
      try {
        // Se suben TODAS las fotos elegidas (menos duplicados), no solo las que
        // caben — las que sobren del cupo no se pierden, quedan disponibles en
        // la bolsa (basta con no asignarlas a ninguna cara; getBag las recoge
        // automáticamente). Secuencial (no en paralelo): cada uploadNewPhoto ya
        // hace su propia subida a R2 + análisis; encadenarlas evita pisarse el
        // estado de book.
        const resultPhotos: PhotoAsset[] = []
        let alreadyOnFaceCount = 0
        let reusedCount = 0

        for (const file of files) {
          const hash = await hashFileContent(file)
          const existing = albumByHash.get(hash)
          if (existing) {
            if (isInBag(existing.id)) {
              reusedCount++
              resultPhotos.push(existing)
            } else {
              alreadyOnFaceCount++
            }
            continue
          }
          const newPhoto = await uploadNewPhoto(file, hash)
          if (newPhoto) {
            resultPhotos.push(newPhoto)
            albumByHash.set(hash, newPhoto) // dedupe también dentro del lote
          }
        }
        if (!structure) return

        const toAssign = resultPhotos.slice(0, bagCapacity)
        const overflow = resultPhotos.length - toAssign.length

        const getAR = (pid: string) => {
          const p = resultPhotos.find(ph => ph.id === pid) ?? photosById.get(pid)
          return p && p.width && p.height ? p.width / p.height : 1.0
        }
        const newStructure = toAssign.reduce(
          (acc, photo) => addPhotoToFace(acc, bagTargetFaceId, photo.id, getAR),
          structure,
        )
        setStructure(newStructure)

        const parts: string[] = []
        if (alreadyOnFaceCount > 0) {
          parts.push(alreadyOnFaceCount === 1 ? 'Esta foto ya está en tu álbum.' : `${alreadyOnFaceCount} fotos ya estaban en tu álbum.`)
        }
        if (reusedCount > 0) {
          parts.push(reusedCount === 1 ? 'Ya tenías esta foto, no la subimos de nuevo.' : `${reusedCount} fotos repetidas, no las subimos de nuevo.`)
        }
        if (overflow > 0) {
          parts.push(`${overflow} de ${resultPhotos.length} foto${resultPhotos.length !== 1 ? 's' : ''} no ${overflow === 1 ? 'cabe' : 'caben'} en esta página, quedaron en tu bolsa`)
        }
        if (parts.length === 0) {
          parts.push(toAssign.length === 1 ? 'Foto agregada' : `${toAssign.length} fotos agregadas`)
        }
        showToast(parts.join(' '), false, parts.length > 1 ? 4500 : 3500)

        setBagSelected([])
        setBagOpen(false)
      } finally {
        setUploadingPhoto(false)
      }
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#EDEBE7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(40,36,30,0.5)',
      }}>
        Cargando...
      </div>
    )
  }

  // ── Sesión requerida ────────────────────────────────────────────────────────
  // No dejar editar "a ciegas": sin sesión, cualquier trabajo del usuario
  // nunca llegaría a Supabase aunque el guardado pareciera exitoso.
  if (!hasSession) {
    return <LoginRequiredScreen bookId={id} />
  }

  if (!book || !structure) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#EDEBE7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(40,36,30,0.5)',
      }}>
        Cargando...
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      // Mismo fondo que el viewer — coherencia editar↔ver.
      background: 'radial-gradient(120% 100% at 50% 38%, #F2F0EA 0%, #EDEBE7 55%, #E6E3DC 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`@keyframes pixia-pop-in{from{opacity:0;scale:0.96}to{opacity:1;scale:1}} @keyframes pixia-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Input de archivo oculto, compartido entre el panel de Cambiar y el de Agregar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      {/* Barra superior */}
      <div style={{
        height: '56px', flexShrink: 0,
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
      }}>
        <button
          onClick={() => { window.location.href = `/book/${id}?spread=${currentFold + 1}` }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', padding: '6px 0' }}
        >
          ← Volver
        </button>

        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: 'rgba(255,255,255,0.85)' }}>
          Editor v2
        </span>

        {/* Botón "Listo" — guarda y navega */}
        <button
          onClick={handleDone}
          disabled={isSaving}
          style={{
            padding: '7px 18px',
            background: isSaving ? 'rgba(232,85,58,0.5)' : '#E8553A',
            border: 'none', borderRadius: '8px',
            color: '#fff', fontSize: '14px', fontWeight: 600,
            cursor: isSaving ? 'default' : 'pointer',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
        >
          {isSaving ? 'Guardando…' : 'Listo'}
        </button>
      </div>

      {/* Banner de problemas [DEV] */}
      {problems.length > 0 && (
        <div style={{
          background: 'rgba(220,150,0,0.12)',
          borderBottom: '1px solid rgba(220,150,0,0.25)',
          padding: '8px 24px', flexShrink: 0,
          fontSize: '12px', color: 'rgba(255,200,50,0.9)', lineHeight: 1.5,
        }}>
          <strong>[DEV]</strong> {problems.length} problema(s) de paridad: {problems.join(' · ')}
        </div>
      )}

      {/* Viewer de pliegos */}
      <FoldStructureViewer
        structure={structure}
        photosById={photosById}
        sel={sel}
        onSel={handleSel}
        currentFold={currentFold}
        onFoldChange={setCurrentFold}
      />

      {/* Hint: visible cuando no hay selección activa */}
      {sel === null && !bagOpen && !replaceTarget && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          fontSize: '11px', color: 'rgba(40,36,30,0.35)',
          pointerEvents: 'none', zIndex: 5,
          letterSpacing: '0.05em', whiteSpace: 'nowrap',
        }}>
          Toca una foto para ajustarla
        </div>
      )}

      {/* Popover flotante: acciones de foto (flota sobre/bajo la foto) */}
      {anchorRect && sel?.type === 'photo' && !bagOpen && !replaceTarget && (
        <PhotoActionsPopover
          photoId={sel.id}
          anchorRect={anchorRect}
          photoFace={photoFace}
          onAction={handleAction}
        />
      )}

      {/* Panel fijo: diseño de cara (bottom-center, nunca clipea) */}
      {sel?.type === 'face' && selectedFace && !bagOpen && !replaceTarget && (
        <FaceDesignPanel
          selectedFace={selectedFace}
          onAction={handleAction}
        />
      )}

      {/* Panel de bolsa — selección múltiple hasta el cupo de la cara */}
      {bagOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 150,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Cabecera */}
          <div style={{
            height: '56px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              Fotos disponibles
              {bagPhotos.length > 0 && (
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                  {bagPhotos.length}
                </span>
              )}
            </span>
            <button
              onClick={() => { setBagOpen(false); setBagSelected([]) }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '22px', lineHeight: 1, cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>

          {/* Contenido */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <UploadNewPhotoButton
              uploading={uploadingPhoto}
              uploadCount={uploadCount}
              onClick={() => { if (fileInputRef.current) fileInputRef.current.multiple = true; fileInputRef.current?.click() }}
            />

            <div style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.32)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px',
            }}>
              Elige de tu bolsa · máx {bagCapacity}
            </div>

            {bagPhotos.length === 0 ? (
              <p style={{
                margin: '24px auto 0', maxWidth: '260px',
                fontSize: '13px', color: 'rgba(255,255,255,0.35)',
                textAlign: 'center', lineHeight: 1.6,
              }}>
                No tienes fotos disponibles en tu bolsa.<br />
                Quita alguna de otra página para moverla aquí, o sube una nueva.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: '8px',
              }}>
                {bagPhotos.map(photo => {
                  const selIdx = bagSelected.indexOf(photo.id)
                  const isSelected = selIdx !== -1
                  const isDisabled = !isSelected && bagSelected.length >= bagCapacity
                  return (
                    <button
                      key={photo.id}
                      onClick={() => toggleBagSelected(photo.id)}
                      disabled={isDisabled}
                      style={{
                        position: 'relative',
                        aspectRatio: '1', padding: 0,
                        border: isSelected ? '2.5px solid #E8553A' : '2.5px solid transparent',
                        borderRadius: '8px', overflow: 'hidden',
                        cursor: isDisabled ? 'default' : 'pointer', background: '#1a1a1a',
                        opacity: isDisabled ? 0.35 : 1,
                        transition: 'opacity 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={e => { if (!isDisabled && !isSelected) e.currentTarget.style.opacity = '0.75' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = isDisabled ? '0.35' : '1' }}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {isSelected && (
                        <span style={{
                          position: 'absolute', top: '5px', right: '5px',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: '#E8553A', color: '#fff',
                          fontSize: '11px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                        }}>
                          {selIdx + 1}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Barra de confirmación — solo con selección pendiente */}
          {bagSelected.length > 0 && (
            <div style={{
              flexShrink: 0, padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '12px',
            }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {bagSelected.length} de {bagCapacity} seleccionada{bagSelected.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleConfirmAddFromBag}
                style={{
                  padding: '9px 20px', border: 'none', borderRadius: '8px',
                  background: '#E8553A', color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Agregar {bagSelected.length > 1 ? `(${bagSelected.length})` : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Panel de cambiar foto — "Subir nueva" (placeholder) + bolsa */}
      {replaceTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 150,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Cabecera */}
          <div style={{
            height: '56px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              Cambiar foto
            </span>
            <button
              onClick={() => setReplaceTarget(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '22px', lineHeight: 1, cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>

          {/* Contenido */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {/* Cambiar es 1:1 por definición — cupo=1, sin selección múltiple */}
            <UploadNewPhotoButton
              uploading={uploadingPhoto}
              uploadCount={uploadCount}
              onClick={() => { if (fileInputRef.current) fileInputRef.current.multiple = false; fileInputRef.current?.click() }}
            />

            <div style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.32)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px',
            }}>
              O elige de tu bolsa{bagPhotos.length > 0 ? ` · ${bagPhotos.length}` : ''}
            </div>

            {bagPhotos.length === 0 ? (
              <p style={{
                margin: '24px auto 0', maxWidth: '260px',
                fontSize: '13px', color: 'rgba(255,255,255,0.35)',
                textAlign: 'center', lineHeight: 1.6,
              }}>
                No tienes fotos disponibles en tu bolsa.<br />
                Quita alguna de otra página para moverla aquí, o sube una nueva.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: '8px',
              }}>
                {bagPhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => handleReplaceFromBag(photo.id)}
                    style={{
                      aspectRatio: '1', padding: 0, border: 'none',
                      borderRadius: '8px', overflow: 'hidden',
                      cursor: 'pointer', background: '#1a1a1a',
                      transition: 'opacity 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '68px', left: '50%', transform: 'translateX(-50%)',
          background: toast.isError ? 'rgba(180,30,30,0.96)' : 'rgba(22,22,22,0.96)',
          border: `1px solid ${toast.isError ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '8px', padding: '7px 16px',
          fontSize: '12px', color: toast.isError ? '#ffaaaa' : 'rgba(255,255,255,0.75)',
          zIndex: 200, pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
