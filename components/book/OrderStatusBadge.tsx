'use client'

import { useEffect, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { ORDER_STAGE_LABEL, orderStage } from '@/core/modules/album/orderLock'
import { PRINT_STATUS_CUSTOMER_LABEL, PRINT_STATUSES, isPrintStatus, statusIndex } from '@/lib/orderStatus'
import { COMMERCIAL } from '@/lib/legal'

interface OrderInfo {
  reference: string
  print_status: string
  paid_at: string | null
  printing_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  shipping_carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipping_city: string | null
  assets_purged_at?: string | null
}

const STEP_AT: Record<string, keyof OrderInfo> = {
  paid: 'paid_at', printing: 'printing_at', shipped: 'shipped_at', delivered: 'delivered_at',
}

function fmt(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * Etiqueta del pedido en el visor de un álbum pagado. Al tocarla muestra en qué
 * va (preparando → en impresión → en camino → entregado) y la guía del envío.
 */
export default function OrderStatusBadge({ bookId, blueprintStatus }: { bookId: string; blueprintStatus?: string | null }) {
  const [info, setInfo] = useState<OrderInfo | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const res = await fetch(`/api/orders/by-book/${encodeURIComponent(bookId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      })
      if (res.ok && !cancelled) setInfo((await res.json()).order)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [bookId])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Pedido archivado: sus fotos ya se borraron (política de conservación), el
  // visor no tendría qué mostrar. Se tapa con un aviso claro.
  if (info?.assets_purged_at) {
    return (
      <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0f0f0f', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 400, marginBottom: 12 }}>Este álbum se archivó</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)' }}>
            Tu pedido {info.reference} se entregó {info.delivered_at ? `el ${new Date(info.delivered_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.
            Como dicen nuestros términos, las fotos y el archivo de impresión se guardan hasta {COMMERCIAL.warrantyDays} días después de la entrega y luego se borran.
          </p>
          <a href="/mis-albumes" style={{ display: 'inline-block', marginTop: 24, padding: '12px 24px', borderRadius: 10, background: '#fff', color: '#000', fontWeight: 600, fontSize: 14 }}>
            Ir a Mis álbumes
          </a>
        </div>
      </div>
    )
  }

  const current = info && isPrintStatus(info.print_status) ? info.print_status : null
  const label = current ? `Pedido · ${PRINT_STATUS_CUSTOMER_LABEL[current]}` : ORDER_STAGE_LABEL[orderStage(blueprintStatus)]
  const idx = statusIndex(current ?? 'paid')

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="whitespace-nowrap rounded-full bg-[rgba(232,85,58,0.14)] px-3 py-1.5 text-xs text-[#F08A72]">
        {label} <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[400] w-[min(320px,calc(100vw-32px))] rounded-xl border border-white/10 bg-[#161616] p-4 text-left text-white shadow-2xl">
          <ol className="space-y-3">
            {PRINT_STATUSES.map((s, i) => {
              const at = info ? (info[STEP_AT[s]] as string | null) : null
              const done = i <= idx
              return (
                <li key={s} className="flex items-start gap-3">
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${done ? 'border-[#E8553A] bg-[#E8553A]' : 'border-white/25'}`} />
                  <div>
                    <div className={`text-sm ${done ? 'text-white' : 'text-white/40'}`}>{PRINT_STATUS_CUSTOMER_LABEL[s]}</div>
                    {done && at && <div className="text-xs text-white/45">{fmt(at)}</div>}
                  </div>
                </li>
              )
            })}
          </ol>
          {info?.tracking_number && (
            <div className="mt-4 rounded-lg bg-white/[0.05] p-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-white/55">Transportadora</span><span>{info.shipping_carrier}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-white/55">Guía</span><span className="font-mono text-xs leading-5">{info.tracking_number}</span></div>
              {info.tracking_url && (
                <a href={info.tracking_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[#F08A72] underline">Rastrear el envío</a>
              )}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-white/45">
            {info ? <>Pedido <span className="font-mono">{info.reference}</span>. </> : null}
            Te avisamos por correo en cada paso. ¿Dudas? soporte@pixiaa.com
          </p>
        </div>
      )}
    </div>
  )
}
