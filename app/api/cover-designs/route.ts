import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** Catálogo público de portadas (solo las visibles). Lo piden el paso 3 y el estudio. */
export async function GET() {
  const { data, error } = await supabaseAdmin.from('cover_designs').select('*')
    .eq('active', true).order('sort').order('created_at', { ascending: false })
  // Sin tabla todavía (no se ha corrido supabase/portadas.sql) o error: catálogo vacío, nunca rompe la página.
  if (error) return NextResponse.json({ designs: [] })
  return NextResponse.json({ designs: data ?? [] }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } })
}
