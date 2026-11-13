import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/admin/auth'
import { listAllDesigns, MIN_ART_PX } from '@/lib/admin/coverDesigns'
import { designToCover, DESIGN_OCCASIONS, type CoverDesign } from '@/lib/coverDesigns'
import CoverRenderer from '@/core/modules/cover/CoverRenderer'
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import { Badge, Card } from '../_components'
import DesignForm from './DesignForm'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * /admin/portadas — catálogo de portadas: subir diseños (por ocasión y país)
 * que aparecen en el paso 3 y en el estudio de portada. No se borran (los
 * álbumes que los eligieron usan su imagen): se ocultan.
 */
export default async function AdminCoversPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  if (!(await isAdminRequest(await headers()))) notFound()
  const sp = await searchParams
  let designs: CoverDesign[] = []
  let loadError: string | null = null
  try { designs = await listAllDesigns() } catch (e) { loadError = e instanceof Error ? e.message : String(e) }
  const label = (id: string) => DESIGN_OCCASIONS.find(o => o.id === id)?.label ?? id

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Portadas</h1>
      {sp.ok && <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Diseño publicado: ya aparece en el paso 3 y en el estudio de portada.</p>}
      {sp.error && <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{sp.error}</p>}
      {loadError && (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudo cargar el catálogo: {loadError}. ¿Ya se corrió <code>supabase/portadas.sql</code>?
        </p>
      )}

      <Card title="Nuevo diseño"><DesignForm minPx={MIN_ART_PX} /></Card>

      <Card title={`Catálogo (${designs.length})`}>
        {designs.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Todavía no hay diseños. Los que subas aparecen en «Sin foto» del paso 3 y del estudio de portada.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {designs.map(d => {
              const cover = { photoId: '', title: d.country ?? label(d.occasion), subtitle: '', date: '', textColor: 'auto', ...designToCover(d) } as CoverConfig
              return (
                <div key={d.id} className={`space-y-2 ${d.active ? '' : 'opacity-45'}`}>
                  <div className="overflow-hidden rounded shadow"><CoverRenderer config={cover} format="30x30" /></div>
                  <div className="text-sm">{d.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="info">{label(d.occasion)}</Badge>
                    {d.country && <Badge tone="muted">{d.country}</Badge>}
                    {!d.active && <Badge tone="warn">oculto</Badge>}
                  </div>
                  <form action="/api/admin/cover-designs" method="post">
                    <input type="hidden" name="action" value="toggle" />
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="active" value={d.active ? '0' : '1'} />
                    <button className="text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline">{d.active ? 'Ocultar' : 'Mostrar'}</button>
                  </form>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
