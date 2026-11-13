import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/admin/auth'
import { launchChecks, MANUAL_STEPS, type CheckStatus, type LaunchCheck } from '@/lib/launchChecks'
import { Badge, Card } from '../_components'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const TONE: Record<CheckStatus, 'ok' | 'warn' | 'bad'> = { ok: 'ok', aviso: 'warn', falta: 'bad' }
const WORD: Record<CheckStatus, string> = { ok: 'Listo', aviso: 'Revisar', falta: 'Falta' }

/**
 * /admin/lanzamiento — qué le falta a esta versión de la web para vender de
 * verdad. Arriba, lo que la web comprueba sola (configuración); abajo, lo que
 * solo se puede revisar a mano. Nunca muestra el valor de una llave.
 */
export default async function AdminLaunchPage() {
  if (!(await isAdminRequest(await headers()))) notFound()

  const checks = launchChecks()
  const groups = [...new Set(checks.map(c => c.group))]
  const count = (s: CheckStatus) => checks.filter(c => c.status === s).length
  const blocking = count('falta')
  const warnings = count('aviso')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Paso a producción</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
          Lo que esta versión de la web necesita para vender de verdad. Se revisa cada vez que abres la página.
        </p>
      </div>

      <div className={`rounded-xl border p-4 text-sm leading-relaxed ${blocking ? 'border-red-400/30 bg-red-500/10 text-red-100' : warnings ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
        {blocking > 0
          ? <><strong>{blocking === 1 ? 'Falta 1 cosa' : `Faltan ${blocking} cosas`} antes de vender.</strong> {warnings > 0 && `Y ${warnings} por revisar.`}</>
          : warnings > 0
            ? <><strong>La configuración está completa.</strong> {warnings === 1 ? 'Queda 1 punto por revisar' : `Quedan ${warnings} puntos por revisar`}, más la lista manual de abajo.</>
            : <><strong>La configuración está lista.</strong> Queda la lista manual de abajo.</>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(group => (
          <Card key={group} title={group}>
            <ul className="space-y-4">
              {checks.filter(c => c.group === group).map(c => <CheckRow key={c.label} check={c} />)}
            </ul>
          </Card>
        ))}
      </div>

      <Card title="Lo que solo puedes revisar tú">
        <ol className="space-y-5">
          {MANUAL_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs tabular-nums text-[var(--text-secondary)]">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {step.title} <span className="ml-1 text-xs font-normal text-[var(--text-tertiary)]">{step.where}</span>
                </p>
                <p className="mt-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function CheckRow({ check }: { check: LaunchCheck }) {
  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{check.label}</p>
        <Badge tone={TONE[check.status]}>{WORD[check.status]}</Badge>
      </div>
      <p className="mt-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{check.detail}</p>
    </li>
  )
}
