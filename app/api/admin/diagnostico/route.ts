import { NextResponse, type NextRequest } from 'next/server'
import { configFromEnv, evaluateAdmin } from '@/lib/admin/auth'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * TEMPORAL — diagnóstico de acceso al portal admin. Borrar cuando /admin
 * funcione. Dice en qué paso falla la verificación SIN exponer secretos: no
 * muestra el token, ni ADMIN_EMAILS, ni CF_ACCESS_AUD (solo si están).
 */
export async function GET(req: NextRequest) {
  const config = configFromEnv()
  const token = req.headers.get('cf-access-jwt-assertion')
  let tokenInfo: Record<string, unknown> | null = null
  if (token) {
    try {
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      tokenInfo = { iss: claims.iss, email: claims.email, aud: claims.aud, vence: claims.exp ? new Date(claims.exp * 1000).toISOString() : null }
    } catch {
      tokenInfo = { error: 'no se pudo leer el token' }
    }
  }
  const result = await evaluateAdmin(req.headers, config)
  return NextResponse.json({
    resultado: 'admin' in result ? 'OK — tienes acceso' : 'DENEGADO',
    motivo: 'reason' in result ? result.reason : null,
    llegoHeaderDeAccess: Boolean(token),
    token: tokenInfo,
    config: {
      CF_ACCESS_TEAM_DOMAIN: config.teamDomain || '(vacío)',
      CF_ACCESS_AUD: config.audiences.length ? `${config.audiences.length} valor(es)` : '(vacío — opcional)',
      ADMIN_EMAILS: config.emails.length ? `${config.emails.length} email(s)` : '(vacío)',
    },
  }, { headers: { 'cache-control': 'no-store' } })
}
