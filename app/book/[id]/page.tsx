'use client'

export const runtime = 'edge'

import { PhotoQualityContext } from '@/core/modules/viewer/PhotoQualityContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import type { AlbumBlueprint, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import { validateAlbumStructure } from '@/core/modules/foldModel/validateStructure'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { getLocalBook } from '@/core/engine/localBookStorage'
import { isOrdered } from '@/core/modules/album/orderLock'
import OrderStatusBadge from '@/components/book/OrderStatusBadge'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import CoverPage from '@/core/modules/viewer/pages/CoverPage'
import BackCoverPage from '@/core/modules/viewer/pages/BackCoverPage'
import { FacePageView, HeroSpreadPageView } from '@/core/modules/viewer/SpreadFaces'
import { PageAspectContext } from '@/core/modules/viewer/PageAspectContext'
import { aspectOfFormat } from '@/core/modules/album/pageGeometry'
import { buildSpreads, isSingleSpread, getSpreadUrls, type ViewerSpread } from '@/core/modules/viewer/spreadModel'
import PixiaFlipBook, { type PixiaFlipBookHandle } from '@/core/modules/viewer/PixiaFlipBook'
import { FlipBookErrorBoundary } from '@/core/modules/viewer/FlipBookErrorBoundary'
import { FaceThumbnail, HeroSpreadThumbnail } from '@/core/modules/viewer/FaceThumbnail'
import PageThumbnailStrip, { type ThumbnailItem } from '@/components/ui/PageThumbnailStrip'

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

/** El visor dibuja la versión liviana de cada foto (ver PhotoQualityContext). */
export default function BookPage() {
  return (
    <PhotoQualityContext.Provider value="display">
      <BookPageInner />
    </PhotoQualityContext.Provider>
  )
}

function BookPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string

  // ── Carga del blueprint ────────────────────────────────────────────────────
  const [book, setBook] = useState<AlbumBlueprint | null>(null)
  const [missing, setMissing] = useState(false)
  const adminView = searchParams.get('admin') === '1'

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
        const b = await getLocalBook(id)
        if (b) { setBook(normalizeBook(b, id)); return }
      } catch (e) { console.error('[Viewer] copia local:', e) }

      // Abierto desde el portal admin (/book/[id]?admin=1): el admin no es el
      // dueño, así que carga por la API admin (protegida con Cloudflare Access).
      if (adminView) {
        try {
          const res = await fetch(`/api/admin/blueprint/${encodeURIComponent(id)}`, { cache: 'no-store' })
          if (res.ok) { setBook(normalizeBook(await res.json(), id)); return }
          console.warn('[Viewer] admin load:', res.status)
        } catch (e) { console.warn('[Viewer] admin load:', e) }
      }

      // Ni en la cuenta ni en este navegador: típicamente otro dispositivo sin sesión.
      setMissing(true)
    }
    loadBook()
  }, [id, adminView])

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

  // ── Tira de miniaturas ──────────────────────────────────────────────────────
  // Un ThumbnailItem por posición navegable (mismo índice que spreadIdx/goTo).
  // Portada y contraportada reusan CoverPage/BackCoverPage tal cual (una sola
  // foto cada una, sin costo real); los pliegos usan FaceThumbnail —liviano,
  // thumbnailUrl en vez de url— para no bajar 50+ fotos a resolución completa
  // en un álbum grande.
  // Proporción de página: 1 en 30×30/20×20, 0.75 en el vertical 21×28.
  const pageAspect = aspectOfFormat(book?.format)

  const thumbItems = useMemo<ThumbnailItem[]>(() => {
    if (!book) return []
    return spreads.map((s, i): ThumbnailItem => {
      if (s.kind === 'cover') {
        return {
          key: 'cover', label: `${i + 1}`, aspectRatio: pageAspect,
          render: <CoverPage photo={coverPhoto} cover={book.cover} style={book.style || 'con-margen'} format={book.format || '30x30'} />,
        }
      }
      if (s.kind === 'back') {
        return { key: 'back', label: `${i + 1}`, aspectRatio: pageAspect, render: <BackCoverPage cover={book.cover} /> }
      }
      if (s.kind === 'paired') {
        return {
          key: `${s.left.id}-${s.right.id}`, label: `${i + 1}`, aspectRatio: 2 * pageAspect,
          render: (
            <div style={{ display: 'flex', width: '100%', height: '100%', gap: '1px' }}>
              <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}><FaceThumbnail face={s.left} photosById={photosById} /></div>
              <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}><FaceThumbnail face={s.right} photosById={photosById} /></div>
            </div>
          ),
        }
      }
      // composition (hero-spread)
      return { key: s.face.id, label: `${i + 1}`, aspectRatio: 2 * pageAspect, render: <HeroSpreadThumbnail face={s.face} photosById={photosById} /> }
    })
  }, [spreads, photosById, coverPhoto, book, pageAspect])

  // ── Fit-contain sizing — grande, aprovechando la pantalla ──────────────────
  const areaRef = useRef<HTMLDivElement>(null)
  // panelSize = ANCHO de una página; panelH = su alto (igual en cuadrado).
  const [panelSize, setPanelSize] = useState(480)
  const panelH = Math.round(panelSize / pageAspect)
  const [isMobile, setIsMobile] = useState(false)
  // Celular en horizontal (pantalla baja): las barras de arriba y abajo se
  // comían ~1/3 del alto y el libro quedaba chico. En ese caso la barra de
  // arriba se adelgaza, la de abajo desaparece (el contador y "Portada" pasan
  // arriba) y se reduce el margen, así el libro crece ~35 %.
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const check = () => setCompact(window.innerHeight < 500 && window.innerWidth > window.innerHeight)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const topBarH = compact ? 44 : 56
  // Guía «Personaliza tu portada»: se muestra hasta que el cliente la cierra
  // (preferencia de este navegador, nada más).
  const [coverTipSeen, setCoverTipSeen] = useState(true)
  useEffect(() => {
    try { setCoverTipSeen(localStorage.getItem('pixia.coverTipSeen') === '1') } catch { setCoverTipSeen(false) }
  }, [])
  const dismissCoverTip = () => {
    setCoverTipSeen(true)
    try { localStorage.setItem('pixia.coverTipSeen', '1') } catch { /* sin almacenamiento: solo se oculta */ }
  }
  const bottomBarH = compact ? 0 : 48

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
      const byHeight = height - (window.innerHeight < 500 ? 10 : 24)
      setPanelSize(Math.floor(Math.max(100, Math.min(byWidth, byHeight * pageAspect))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [book, structure, compact, pageAspect])

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
      if (s) preload(getSpreadUrls(s, photosById, coverPhoto, 'display'))
    }

    // Diferido 300ms: N-2 y N+2
    const t = setTimeout(() => {
      for (const offset of [-2, 2]) {
        const s = spreads[spreadIdx + offset]
        if (s) preload(getSpreadUrls(s, photosById, coverPhoto, 'display'))
      }
    }, 300)
    return () => clearTimeout(t)
  }, [spreadIdx, spreads, photosById, coverPhoto])

  // ── No encontrado ──────────────────────────────────────────────────────────
  if (missing && !book) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0f0f0f', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, marginBottom: 12 }}>
            No encontramos este álbum
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 28 }}>
            Si ya lo pediste, entra con tu correo y lo verás en tus álbumes.
          </p>
          <a href="/mis-albumes" style={{
            display: 'inline-block', background: 'var(--brand-coral)', color: '#fff',
            padding: '12px 24px', borderRadius: 10, fontWeight: 500, textDecoration: 'none',
          }}>
            Ir a mis álbumes
          </a>
        </div>
      </div>
    )
  }

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
  // Pagado = congelado: se puede ver y mostrar, no editar ni volver a pagar.
  const ordered = isOrdered(book.status)
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
    height: `${panelH}px`,
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
        return <div style={panelStyle}><BackCoverPage cover={book.cover} /></div>
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
    <PageAspectContext.Provider value={pageAspect}>
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
        position: 'fixed', top: 0, left: 0, right: 0, height: `${topBarH}px`,
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: '0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left))', zIndex: 300,
      }}>
        <button
          onClick={() => (ordered ? router.push('/mis-albumes') : window.history.back())}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px' }}
        >
          {ordered ? '← Mis álbumes' : '← Volver'}
        </button>

        <span style={{ display: 'flex', alignItems: 'baseline', gap: '12px', minWidth: 0 }}>
          <span style={{
            fontFamily: 'Playfair Display, serif', fontSize: '16px', color: 'white',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
          {compact && (
            <>
              <button onClick={() => goTo(0)} disabled={displayIdx === 0} aria-label="Ir a la portada" style={{
                background: 'none', border: 'none', padding: 0, fontSize: '13px', cursor: 'pointer',
                color: displayIdx === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)',
              }}>↺</button>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {displayIdx + 1} / {totalSpreads}
              </span>
            </>
          )}
        </span>

        {ordered ? (
          <OrderStatusBadge bookId={id} blueprintStatus={book.status} />
        ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* En la portada, «Editar» abre el estudio de portada (plantillas,
              letras, colores, tapa sin foto y lomo). */}
          <button
            onClick={() => router.push(displayIdx === 0 ? `/book/${id}/edit-v2?portada=1` : `/book/${id}/edit-v2?spread=${displayIdx}`)}
            style={{
              fontSize: '12px', padding: '6px 14px', borderRadius: '6px',
              border: displayIdx === 0 ? '1px solid rgba(232,85,58,0.7)' : '1px solid rgba(255,255,255,0.15)',
              background: displayIdx === 0 ? 'rgba(232,85,58,0.12)' : 'none',
              color: displayIdx === 0 ? '#fff' : 'rgba(255,255,255,0.7)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {displayIdx === 0 ? (compact ? 'Portada' : 'Editar portada') : 'Editar'}
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
        )}
      </div>

      {/* Guía de una sola vez: dónde se personaliza la portada. */}
      {!ordered && displayIdx === 0 && !coverTipSeen && (
        <div role="note" style={{
          position: 'fixed', top: `${topBarH + 10}px`, right: '12px', zIndex: 70, maxWidth: '280px',
          background: '#1c1b1a', color: '#fff', borderRadius: '12px', padding: '12px 14px',
          border: '1px solid rgba(232,85,58,0.45)', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.6)', fontSize: '13px', lineHeight: 1.45,
        }}>
          <span aria-hidden style={{ position: 'absolute', top: '-6px', right: '48px', width: '10px', height: '10px', background: '#1c1b1a', borderLeft: '1px solid rgba(232,85,58,0.45)', borderTop: '1px solid rgba(232,85,58,0.45)', transform: 'rotate(45deg)' }} />
          <strong style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Personaliza tu portada</strong>
          Letras, colores, ilustraciones y el lomo: todo en <em style={{ fontStyle: 'normal', color: '#E8553A' }}>Editar portada</em>.
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={dismissCoverTip} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer' }}>Entendido</button>
            <button onClick={() => { dismissCoverTip(); router.push(`/book/${id}/edit-v2?portada=1`) }} style={{ background: '#E8553A', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Personalizar</button>
          </div>
        </div>
      )}

      {/* Área del pliego */}
      <div
        ref={areaRef}
        style={{
          flex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: `${topBarH}px`, paddingBottom: `${bottomBarH}px`,
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
              height={panelH}
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
            height: `${panelH}px`,
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
        // En celular (una página a la vez) la flecha pasa de a UNA página.
        onClick={() => (isMobile && !flipFailed ? flipRef.current?.flipPrev() : goTo(displayIdx - 1))}
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
        // En celular (una página a la vez) la flecha pasa de a UNA página.
        onClick={() => (isMobile && !flipFailed ? flipRef.current?.flipNext() : goTo(displayIdx + 1))}
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
      {!compact && <div style={{
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
      </div>}

      {/* Tira de miniaturas — navegación rápida entre páginas */}
      <PageThumbnailStrip
        items={thumbItems}
        currentIndex={displayIdx}
        onSelect={goTo}
        bottomBarHeight={bottomBarH}
      />

    </div>
    </PageAspectContext.Provider>
  )
}
