'use client'

export const runtime = 'edge'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import type { AlbumBlueprint, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import { validateAlbumStructure } from '@/core/modules/foldModel/validateStructure'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import CoverPage from '@/core/modules/viewer/pages/CoverPage'
import BackCoverPage from '@/core/modules/viewer/pages/BackCoverPage'
import { FacePageView, HeroSpreadPageView } from '@/core/modules/viewer/SpreadFaces'
import { buildSpreads, isSingleSpread, getSpreadUrls, type ViewerSpread } from '@/core/modules/viewer/spreadModel'
import PixiaFlipBook, { type PixiaFlipBookHandle } from '@/core/modules/viewer/PixiaFlipBook'
import { FlipBookErrorBoundary } from '@/core/modules/viewer/FlipBookErrorBoundary'

// ── Keyframes CSS del fallback estático — inyectados una sola vez ──────────────

const SLIDE_KEYFRAMES = `
  @keyframes pixia-out-left  { from { transform: translateX(0) } to { transform: translateX(-100%) } }
  @keyframes pixia-out-right { from { transform: translateX(0) } to { transform: translateX(100%)  } }
  @keyframes pixia-in-right  { from { transform: translateX(100%)  } to { transform: translateX(0) } }
  @keyframes pixia-in-left   { from { transform: translateX(-100%) } to { transform: translateX(0) } }
`

type Trans =
  | { phase: 'idle' }
  | { phase: 'go'; from: number; to: number; dir: 'next' | 'prev' }

const ANIM_MS = 400

const GUTTER_SHADOW =
  'linear-gradient(to right,' +
  'rgba(0,0,0,0) 0%,' +
  'rgba(0,0,0,0.10) 45%,' +
  'rgba(0,0,0,0.16) 50%,' +
  'rgba(0,0,0,0.10) 55%,' +
  'rgba(0,0,0,0) 100%)'

// ── Viewer principal ──────────────────────────────────────────────────────────

export default function BookPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string

  // ── Carga del blueprint ────────────────────────────────────────────────────
  const [book, setBook] = useState<AlbumBlueprint | null>(null)

  useEffect(() => {
    async function loadBook() {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession()
        if (session) {
          const { data, error } = await supabaseBrowser
            .from('blueprints').select('*').eq('id', id).single()
          if (!error && data) { setBook(normalizeBook(data, id)); return }
          if (error) console.warn('[Viewer] Supabase load:', error.message)
        }
      } catch (e) { console.warn('[Viewer] Supabase:', e) }

      try {
        const raw = localStorage.getItem('pixia_books')
        if (!raw) return
        const books = JSON.parse(raw)
        const b = books[id]
        if (b) setBook(normalizeBook(b, id))
      } catch (e) { console.error('[Viewer] localStorage:', e) }
    }
    loadBook()
  }, [id])

  // ── Estructura ─────────────────────────────────────────────────────────────
  const structureInitialized = useRef(false)
  const [structure, setStructure] = useState<AlbumStructure | null>(null)

  useEffect(() => {
    if (!book || structureInitialized.current) return
    structureInitialized.current = true

    if (book.structure) {
      const knownIds = new Set<string>()
      for (const s of book.spreads) for (const p of s.photos) knownIds.add(p.id)
      const v = validateAlbumStructure(book.structure, knownIds)
      if (v.ok) { setStructure(book.structure); return }
      console.warn('[Viewer] structure descartada:', v.reason)
    }

    const { structure: derived } = foldsFromBlueprint(book)
    setStructure(derived)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book])

  // ── Mapa de fotos ──────────────────────────────────────────────────────────
  const photosById = useMemo(() => {
    if (!book) return new Map<string, PhotoAsset>()
    const map = new Map<string, PhotoAsset>()
    const seen = new Set<string>()
    for (const s of book.spreads) {
      for (const p of s.photos) {
        if (!seen.has(p.id)) { seen.add(p.id); map.set(p.id, p) }
      }
    }
    return map
  }, [book])

  // coverPhoto disponible antes del return condicional para usarlo en effects
  const coverPhoto = useMemo<PhotoAsset | undefined>(() => {
    if (!book) return undefined
    return photosById.get(book.cover.photoId) ?? [...photosById.values()][0]
  }, [book, photosById])

  // ── Pliegos derivados ──────────────────────────────────────────────────────
  const spreads = useMemo<ViewerSpread[]>(() => buildSpreads(structure), [structure])

  // ── Fit-contain sizing — grande, aprovechando la pantalla ──────────────────
  const areaRef = useRef<HTMLDivElement>(null)
  const [panelSize, setPanelSize] = useState(480)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const el = areaRef.current
    // areaRef solo existe una vez que book/structure cargaron (antes de eso
    // se renderiza la pantalla de "Cargando…" sin este nodo) — por eso el
    // efecto depende de ambos, no de [] — si no, nunca vuelve a intentar
    // observar el nodo real y el pliego queda atascado en el tamaño inicial.
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const mobile = width < 640
      setIsMobile(mobile)
      const byWidth = mobile ? width - 24 : (width - 40) / 2
      const byHeight = height - 24
      setPanelSize(Math.floor(Math.max(100, Math.min(byWidth, byHeight))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [book, structure])

  const gutterWidth = Math.round(Math.min(36, Math.max(14, panelSize * 0.05)))

  // ── Navegación ─────────────────────────────────────────────────────────────
  // Posición inicial compartida con el editor: portada = 0, primer pliego
  // interior = 1, etc. (índice de pliego del foldModel — mismo que
  // spreadIdxToPageIndex usa para mapear a página física del flipbook).
  const [spreadIdx, setSpreadIdx] = useState(() => {
    const raw = parseInt(searchParams.get('spread') ?? '', 10)
    return Number.isFinite(raw) && raw > 0 ? raw : 0
  })
  const [trans, setTrans] = useState<Trans>({ phase: 'idle' })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // El flipbook 3D es el modo por defecto; si react-pageflip falla, se cae
  // al render estático con transición CSS — nunca pantalla negra.
  const [flipFailed, setFlipFailed] = useState(false)
  const flipRef = useRef<PixiaFlipBookHandle>(null)

  // Refs estables para el keyboard handler (evita stale closure)
  const spreadIdxRef = useRef(0)
  spreadIdxRef.current = spreadIdx
  const goToRef = useRef<(idx: number) => void>(() => {})

  const goTo = (target: number) => {
    if (!spreads.length) return
    const clamped = Math.max(0, Math.min(spreads.length - 1, target))
    if (clamped === spreadIdx) return

    if (!flipFailed) {
      // El flipbook maneja su propia animación de giro; spreadIdx se
      // actualiza cuando termina, vía onFlip.
      flipRef.current?.goTo(clamped)
      return
    }

    // ── Fallback estático: transición CSS manual ──────────────────────────
    if (trans.phase === 'go') {
      if (timerRef.current) clearTimeout(timerRef.current)
      setSpreadIdx(trans.to)
      setTrans({ phase: 'idle' })
      return
    }

    const fromS = spreads[spreadIdx]
    const toS = spreads[clamped]

    if (!fromS || !toS || isSingleSpread(fromS) !== isSingleSpread(toS)) {
      setSpreadIdx(clamped)
      return
    }

    const dir: 'next' | 'prev' = clamped > spreadIdx ? 'next' : 'prev'
    setTrans({ phase: 'go', from: spreadIdx, to: clamped, dir })

    timerRef.current = setTimeout(() => {
      setSpreadIdx(clamped)
      setTrans({ phase: 'idle' })
    }, ANIM_MS + 30)
  }

  goToRef.current = goTo

  // Limpiar timer al desmontar
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // Teclado (arrows)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToRef.current(spreadIdxRef.current + 1)
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goToRef.current(spreadIdxRef.current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // estable — accede a estado solo a través de refs

  // ── Precarga de vecinos (para que el curl revele fotos ya cacheadas) ──────
  const preloaded = useRef(new Set<string>())

  useEffect(() => {
    if (!spreads.length) return

    const preload = (urls: string[]) => {
      for (const url of urls) {
        if (url && !preloaded.current.has(url)) {
          preloaded.current.add(url)
          const img = new Image()
          img.src = url
        }
      }
    }

    // Inmediato: N-1 y N+1
    for (const offset of [-1, 1]) {
      const s = spreads[spreadIdx + offset]
      if (s) preload(getSpreadUrls(s, photosById, coverPhoto))
    }

    // Diferido 300ms: N-2 y N+2
    const t = setTimeout(() => {
      for (const offset of [-2, 2]) {
        const s = spreads[spreadIdx + offset]
        if (s) preload(getSpreadUrls(s, photosById, coverPhoto))
      }
    }, 300)
    return () => clearTimeout(t)
  }, [spreadIdx, spreads, photosById, coverPhoto])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!book || !structure) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#EDEBE7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(40,36,30,0.5)', fontFamily: 'system-ui, sans-serif',
      }}>
        Cargando…
      </div>
    )
  }

  const title = book.cover.title || book.narrative?.title || 'Mi álbum'
  const totalSpreads = spreads.length

  // spreadIdx puede venir de un ?spread= con un valor fuera de rango (álbum
  // editado y con menos pliegos, o un link viejo) — se acota solo para
  // render/display; el estado crudo se autocorrige en el próximo flip vía
  // onFlip, así que no hace falta más que esto.
  const displayIdx = Math.max(0, Math.min(spreads.length - 1, spreadIdx))

  // Pliego a mostrar (o el "from" durante animación, solo aplica al fallback)
  const displaySpread = trans.phase === 'go' ? spreads[trans.from] : spreads[displayIdx]
  if (!displaySpread) return null

  const isSingle = isSingleSpread(displaySpread)
  const spreadContainerW = isSingle ? panelSize : panelSize * 2 + 4

  const panelStyle: React.CSSProperties = {
    width: `${panelSize}px`,
    height: `${panelSize}px`,
    flexShrink: 0,
    overflow: 'hidden',
    background: '#F9F6F1',
    borderRadius: '3px',
  }

  const renderSpreadContent = (s: ViewerSpread) => {
    switch (s.kind) {
      case 'cover':
        return (
          <div style={panelStyle}>
            <CoverPage
              photo={coverPhoto}
              cover={book.cover}
              style={book.style || 'con-margen'}
              format={book.format || '30x30'}
            />
          </div>
        )
      case 'back':
        return <div style={panelStyle}><BackCoverPage /></div>
      case 'paired':
        return (
          <>
            <div style={panelStyle}><FacePageView face={s.left} photosById={photosById} /></div>
            <div style={panelStyle}><FacePageView face={s.right} photosById={photosById} /></div>
          </>
        )
      case 'composition':
        return (
          <>
            <div style={panelStyle}><HeroSpreadPageView face={s.face} photosById={photosById} half="left" /></div>
            <div style={panelStyle}><HeroSpreadPageView face={s.face} photosById={photosById} half="right" /></div>
          </>
        )
    }
  }

  const outAnim = trans.phase === 'go'
    ? (trans.dir === 'next' ? 'pixia-out-left' : 'pixia-out-right')
    : ''
  const inAnim = trans.phase === 'go'
    ? (trans.dir === 'next' ? 'pixia-in-right' : 'pixia-in-left')
    : ''

  const animLayerStyle = (anim: string): React.CSSProperties => ({
    position: 'absolute', inset: 0,
    display: 'flex', gap: isSingle ? 0 : '4px',
    animation: `${anim} ${ANIM_MS}ms cubic-bezier(.4,0,.2,1) both`,
  })

  const gutterStyle: React.CSSProperties = {
    position: 'absolute', top: 0, bottom: 0,
    left: '50%', transform: 'translateX(-50%)',
    width: `${gutterWidth}px`,
    background: GUTTER_SHADOW,
    pointerEvents: 'none',
    zIndex: 20,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      // Gris cálido claro, no blanco puro (se fundiría con el papel crema
      // del libro) ni negro (se traga la sombra proyectada).
      background: 'radial-gradient(120% 100% at 50% 38%, #F2F0EA 0%, #EDEBE7 55%, #E6E3DC 100%)',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* Keyframes de transición del fallback estático */}
      <style>{SLIDE_KEYFRAMES}</style>

      {/* Barra superior */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 300,
      }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Volver
        </button>

        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', color: 'white' }}>
          {title}
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => router.push(`/book/${id}/edit-v2?spread=${displayIdx}`)}
            style={{
              fontSize: '12px', padding: '6px 14px', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            }}
          >
            Editar
          </button>
          <button
            onClick={() => router.push(`/checkout/${id}`)}
            style={{
              background: '#fff', color: '#000', border: 'none',
              borderRadius: '6px', padding: '6px 14px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Comprar álbum
          </button>
        </div>
      </div>

      {/* Área del pliego */}
      <div
        ref={areaRef}
        style={{
          flex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: '56px', paddingBottom: '48px',
          overflow: 'hidden',
        }}
      >
        {!flipFailed ? (
          <FlipBookErrorBoundary onError={() => setFlipFailed(true)}>
            <PixiaFlipBook
              ref={flipRef}
              spreads={spreads}
              photosById={photosById}
              coverPhoto={coverPhoto}
              cover={book.cover}
              style={book.style || 'con-margen'}
              format={book.format || '30x30'}
              width={panelSize}
              height={panelSize}
              isMobile={isMobile}
              isCompositionCurrent={displaySpread.kind === 'composition'}
              gutterWidth={gutterWidth}
              initialSpreadIdx={displayIdx}
              onFlip={(idx) => setSpreadIdx(idx)}
            />
          </FlipBookErrorBoundary>
        ) : (
          /* Fallback estático — se activa solo si react-pageflip falla */
          <div style={{
            position: 'relative',
            width: `${spreadContainerW}px`,
            height: `${panelSize}px`,
            filter: 'drop-shadow(0 26px 48px rgba(80,68,52,0.22)) drop-shadow(0 8px 20px rgba(80,68,52,0.16))',
          }}>
            {trans.phase === 'idle' ? (
              <div style={{ display: 'flex', gap: isSingle ? 0 : '4px', width: '100%', height: '100%' }}>
                {renderSpreadContent(spreads[displayIdx])}
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <div style={animLayerStyle(outAnim)}>
                  {renderSpreadContent(spreads[trans.from])}
                </div>
                <div style={animLayerStyle(inAnim)}>
                  {renderSpreadContent(spreads[trans.to])}
                </div>
              </div>
            )}
            {!isSingle && <div style={gutterStyle} />}
          </div>
        )}
      </div>

      {/* Flecha izquierda */}
      <button
        onClick={() => goTo(displayIdx - 1)}
        disabled={displayIdx === 0}
        style={{
          position: 'fixed', left: '20px', top: '50%', transform: 'translateY(-50%)',
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'white', fontSize: '20px', cursor: displayIdx === 0 ? 'default' : 'pointer',
          zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: displayIdx === 0 ? 0.15 : 1, transition: 'opacity 0.15s',
        }}
      >‹</button>

      {/* Flecha derecha */}
      <button
        onClick={() => goTo(displayIdx + 1)}
        disabled={displayIdx >= totalSpreads - 1}
        style={{
          position: 'fixed', right: '20px', top: '50%', transform: 'translateY(-50%)',
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'white', fontSize: '20px', cursor: displayIdx >= totalSpreads - 1 ? 'default' : 'pointer',
          zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: displayIdx >= totalSpreads - 1 ? 0.15 : 1, transition: 'opacity 0.15s',
        }}
      >›</button>

      {/* Barra inferior */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '48px',
        background: 'rgba(10,10,10,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
          <button
            onClick={() => goTo(0)}
            disabled={displayIdx === 0}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', padding: '4px 10px', lineHeight: 1,
              color: displayIdx === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
              fontSize: '13px', cursor: displayIdx === 0 ? 'default' : 'pointer',
            }}
          >↺ Portada</button>

          <span style={{ color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
            {displayIdx + 1} / {totalSpreads}
          </span>
        </div>
      </div>

    </div>
  )
}
