'use client'

export const runtime = 'edge'

import { getFormat } from '@/lib/formats'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { buildPixiaBookWithAI } from '../../../core/engine/buildPixiaBook'
import { saveBookToLocal } from '../../../core/engine/localBookStorage'
import { useWizard } from '../../../components/create/WizardProvider'
import { MIN_PHOTOS, MAX_PHOTOS } from '@/core/modules/upload/limits'
import { DESIGN_KEYS } from '@/core/modules/cover/coverDesign'
import { readPhotoAnalysis, readR2Photos, readR2Displays, mergeR2Photos } from '@/core/modules/upload/photoSession'
import { useUpload } from '@/core/modules/upload/useUpload'
import { useSession } from '@/core/modules/session/useSession'

/**
 * Generación del álbum. Antes había una pantalla de espera FALSA
 * (/create/loading: barra que subía sola y 30 s fijos) y recién después esta
 * página hacía el trabajo con un "Generando tu libro..." plano. Ahora esta
 * página muestra el progreso REAL (fotos preparadas, diseño, guardado) y, si
 * algo falla, un mensaje claro con salida.
 */

/** Las fotos marcadas con ⭐ suben a este score: abren capítulos y ganan páginas a sangre. */
const STARRED_SCORE = 100

type Phase = 'subiendo' | 'fotos' | 'diseno' | 'guardando' | 'listo'

const PHASE_COPY: Record<Phase, { title: string; sub: string }> = {
  subiendo: { title: 'Subiendo tus fotos', sub: 'Guardándolas en alta calidad para imprimir' },
  fotos: { title: 'Preparando tus fotos', sub: 'Ordenándolas por fecha y momento' },
  diseno: { title: 'Diseñando cada página', sub: 'Eligiendo el mejor diseño para cada momento' },
  guardando: { title: 'Dando los últimos toques', sub: 'Tu álbum está casi listo' },
  listo: { title: '¡Listo!', sub: 'Abriendo tu álbum' },
}

export default function ResultPage() {
  const router = useRouter()
  const { state, dispatch } = useWizard()
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('fotos')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [attempt, setAttempt] = useState(0)
  /** Fotos que no se pudieron subir después de reintentar: el cliente decide qué hacer. */
  const [uploadIssue, setUploadIssue] = useState<{ missing: number; total: number } | null>(null)
  /** El cliente eligió armar el álbum sin las fotos que no subieron. */
  const skipMissing = useRef(false)
  const running = useRef(false)
  const { sessionId, isReady: sessionReady } = useSession()
  const { uploadProgress, uploadPhotos } = useUpload(sessionId || '')

  useEffect(() => {
    if (!sessionReady) return
    if (running.current) return
    if (state.photos.length === 0) return
    running.current = true
    setError(null)
    setUploadIssue(null)
    setPhase('fotos')
    setDone(0)

    async function build() {
      try {
        // Todo se empareja por el id de la foto (ver photoSession.ts).
        const analysis = readPhotoAnalysis()
        const r2Map = readR2Photos()
        const r2Displays = readR2Displays()

        // Orden cronológico por fecha de captura (EXIF); sin fecha, al final
        // en el orden en que se eligieron.
        const time = (id: string) => {
          const t = analysis.get(id)?.takenAt
          return t ? new Date(t).getTime() : Infinity
        }
        const chosen = state.photos
          .slice(0, MAX_PHOTOS)
          .map((p, i) => ({ p, i }))
          .sort((a, b) => (time(a.p.id) - time(b.p.id)) || (a.i - b.i))
          .map(({ p }) => p)
        setTotal(chosen.length)

        // Fotos que no alcanzaron a subirse en el paso 2 (se pasó rápido, falló
        // la red...): se suben ahora.
        const missing = chosen.filter(p => !r2Map.has(p.id))
        if (missing.length > 0 && sessionId && !skipMissing.current) {
          setPhase('subiendo')
          const uploaded = await uploadPhotos(missing.map(p => ({ file: p.file, photoId: p.id })))
          for (const u of uploaded) r2Map.set(u.photoId, u.url)
          mergeR2Photos(uploaded, new Set(state.photos.map(p => p.id)))
          for (const u of uploaded) if (u.thumbnailUrl && u.thumbnailUrl !== u.url) r2Displays.set(u.photoId, u.thumbnailUrl)
          setPhase('fotos')
        }

        // Al álbum solo entran fotos subidas en alta calidad: es lo que se
        // imprime. (Antes una foto que no subía entraba como copia comprimida
        // y salía pixelada o en blanco en el PDF, sin que nadie se enterara.)
        // Si falta alguna se le dice al cliente, que decide: reintentar o
        // seguir sin esas.
        const filesToProcess = chosen.filter(p => r2Map.has(p.id))
        const notUploaded = chosen.length - filesToProcess.length
        if (notUploaded > 0 && !skipMissing.current) {
          setUploadIssue({ missing: notUploaded, total: chosen.length })
          running.current = false
          return
        }
        setTotal(filesToProcess.length)

        let processed = 0
        const results = await Promise.allSettled(
          filesToProcess.map(async (p, index) => {
            const meta = analysis.get(p.id)
            const r2Url = r2Map.get(p.id)!
            const src = r2Url
            setDone(++processed)
            const baseScore = meta?.score || null
            const score = p.priority
              ? { ...(baseScore ?? {}), finalScore: Math.max(baseScore?.finalScore ?? 0, STARRED_SCORE) }
              : baseScore
            return {
              id: p.id,
              src,
              url: src,
              // Versión liviana para el visor (users/<sesión>/display/); si no
              // hay, la misma URL. Nunca el base64 de análisis: el visor la usaría.
              thumbnailUrl: r2Displays.get(p.id) || r2Url,
              r2Key: '',
              width: meta?.width ?? 0,
              height: meta?.height ?? 0,
              takenAt: meta?.takenAt || null,
              orientation: (meta?.orientation || 'landscape') as 'landscape' | 'portrait' | 'square',
              score,
              originalName: p.file?.name || `photo-${index}`,
              contentHash: meta?.contentHash ?? p.contentHash,
            }
          })
        )

        const photos = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
        const failed = results.length - photos.length
        if (failed > 0) console.warn(`[Result] ${failed} foto(s) no se pudieron leer y se omitieron`)

        if (photos.length < MIN_PHOTOS) {
          throw new Error(
            `Solo pudimos leer ${photos.length} de ${chosen.length} fotos y necesitamos al menos ${MIN_PHOTOS}. ` +
            'Vuelve, agrega algunas más e inténtalo de nuevo.',
          )
        }

        setPhase('diseno')
        const coverPhotoId = photos.some(p => p.id === state.cover?.photoId) ? state.cover?.photoId : undefined
        const book = await buildPixiaBookWithAI({
          photos,
          story: state.storyType ?? 'general',
          format: getFormat(state.format).blueprintFormat,
          title: state.cover?.title?.trim() || undefined,
          subtitle: state.cover?.subtitle,
          date: state.cover?.date,
          coverPhotoId,
          // Diseño elegido en el paso 3 (plantilla con foto o gráfica, etc.).
          coverDesign: state.cover?.templateId
            ? Object.fromEntries(DESIGN_KEYS.map(k => [k, state.cover?.[k]]).filter(([, v]) => v !== undefined))
            : undefined,
        })

        setPhase('guardando')
        await saveBookToLocal(book)

        setPhase('listo')
        router.push(`/book/${book.identity.bookId}`)
      } catch (err) {
        console.error('[Pixia] ERROR en generación:', err)
        const msg = err instanceof Error ? err.message : String(err)
        setError(/QuotaExceeded|quota/i.test(msg)
          ? 'Tu navegador se quedó sin espacio para guardar el álbum. Prueba con menos fotos o desde otro navegador.'
          : msg.startsWith('Solo pudimos') ? msg : 'Algo salió mal mientras armábamos tu álbum. Tus fotos siguen aquí: inténtalo de nuevo.')
        running.current = false
      }
    }

    build()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.photos, state.storyType, state.format, state.cover, router, attempt, sessionId])

  const backToPhotos = () => {
    dispatch({ type: 'PREV_STEP' })
    router.push('/create')
  }

  // Llegó sin fotos (recargó la página o entró directo): la sesión del asistente se perdió.
  if (state.photos.length === 0) {
    return (
      <Centered>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-white">Empecemos de nuevo</h1>
        <p className="mt-3 text-white/60">Se reinició la sesión y ya no tenemos tus fotos en esta pestaña.</p>
        <button onClick={() => router.push('/create')} className="mt-8 rounded-lg bg-[var(--brand-coral)] px-6 py-3 font-medium text-white hover:brightness-110">
          Crear mi álbum
        </button>
      </Centered>
    )
  }

  if (uploadIssue) {
    const { missing, total: chosenTotal } = uploadIssue
    const uploaded = chosenTotal - missing
    const one = missing === 1
    return (
      <Centered>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-white">
          {one ? 'Una foto no terminó de subir' : `${missing} fotos no terminaron de subir`}
        </h1>
        <p className="mt-3 text-white/60">
          Subimos {uploaded} de tus {chosenTotal} fotos. Revisa tu conexión a internet y vuelve a intentarlo: tus fotos siguen aquí.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => { skipMissing.current = false; setAttempt(a => a + 1) }} className="rounded-lg bg-[var(--brand-coral)] px-6 py-3 font-medium text-white hover:brightness-110">
            Reintentar la subida
          </button>
          {uploaded >= MIN_PHOTOS && (
            <button onClick={() => { skipMissing.current = true; setAttempt(a => a + 1) }} className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white hover:bg-white/5">
              {one ? 'Seguir sin esa foto' : `Seguir sin esas ${missing} fotos`}
            </button>
          )}
        </div>
        <button onClick={backToPhotos} className="mt-5 text-sm text-white/45 underline-offset-4 hover:text-white/70 hover:underline">
          Volver a mis fotos
        </button>
      </Centered>
    )
  }

  if (error) {
    return (
      <Centered>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-white">No pudimos terminar tu álbum</h1>
        <p className="mt-3 text-white/60">{error}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => setAttempt(a => a + 1)} className="rounded-lg bg-[var(--brand-coral)] px-6 py-3 font-medium text-white hover:brightness-110">
            Intentar de nuevo
          </button>
          <button onClick={backToPhotos} className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white hover:bg-white/5">
            Volver a mis fotos
          </button>
        </div>
      </Centered>
    )
  }

  // Progreso real: preparar fotos = 0–80 %, diseño = 90 %, guardar = 97 %, listo = 100 %
  // (si hay fotos por subir, la subida ocupa 0–60 % y preparar 60–80 %)
  const up = uploadProgress.total ? uploadProgress.completed / uploadProgress.total : 0
  const pct = phase === 'subiendo' ? Math.round(up * 60)
    : phase === 'fotos' ? (total ? Math.round((uploadProgress.total ? 60 : 0) + (done / total) * (uploadProgress.total ? 20 : 80)) : 0)
    : phase === 'diseno' ? 90 : phase === 'guardando' ? 97 : 100
  const copy = PHASE_COPY[phase]

  return (
    <Centered>
      <div className="relative h-11 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.h1 key={phase} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }} className="font-[family-name:var(--font-display)] text-3xl text-white">
            {copy.title}
          </motion.h1>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-white/55">
        {phase === 'subiendo' && uploadProgress.total ? `${copy.sub} · ${uploadProgress.completed} de ${uploadProgress.total}`
          : phase === 'fotos' && total ? `${copy.sub} · ${done} de ${total}` : copy.sub}
      </p>
      <div className="mx-auto mt-10 h-[2px] w-full max-w-sm overflow-hidden rounded bg-white/10">
        <motion.div className="h-full bg-[var(--brand-coral)]" animate={{ width: `${pct}%` }} transition={{ ease: 'easeOut', duration: 0.4 }} />
      </div>
      <p className="mt-3 text-xs tabular-nums text-white/35">{pct}%</p>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  )
}
