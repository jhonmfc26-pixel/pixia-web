import { supabaseAdmin } from '@/lib/supabase'

/** Una corrida de medición/limpieza (tabla storage_reports, ver supabase/almacenamiento.sql). */
export interface StorageReport {
  id: number
  created_at: string
  mode: 'prueba' | 'aplicada' | string
  photos_bytes: number
  photos_objects: number
  pdfs_bytes: number
  pdfs_objects: number
  to_delete_bytes: number
  to_delete_objects: number
  deleted_bytes: number
  deleted_objects: number
  deleted_blueprints: number
  purged_orders: number
  budget_bytes: number | null
  details: {
    counts?: { draftsActive: number; draftsExpired: number; ordersActive: number; ordersExpired: number }
    drafts_to_delete?: number
    orders_to_purge?: number
    oldest_photo?: string | null
    monthly_cost_usd?: number
    errors?: string[]
  } | null
  error: string | null
}

export async function listStorageReports(limit = 30): Promise<StorageReport[]> {
  const { data, error } = await supabaseAdmin
    .from('storage_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as StorageReport[]
}

/** Pide al contenedor una medición en modo prueba (no borra nada). */
export async function requestStorageMeasure(): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = process.env.PDF_CONTAINER_URL
  const secret = process.env.PDF_CONTAINER_SECRET
  if (!base || !secret) return { ok: false, error: 'Faltan PDF_CONTAINER_URL y/o PDF_CONTAINER_SECRET en Cloudflare Pages.' }
  try {
    const res = await fetch(new URL('/storage-cleanup?mode=prueba', base), {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    })
    if (!res.ok) return { ok: false, error: `El servicio respondió ${res.status}: ${(await res.text()).slice(0, 300)}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
