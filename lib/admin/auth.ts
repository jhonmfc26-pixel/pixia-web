/**
 * Autenticación del portal admin (/admin, /api/admin/*).
 *
 * Dos capas, cerrado por defecto:
 *   1. Cloudflare Access delante de pixiaa.com/admin y /api/admin (política
 *      con el email de Jhon). Access inyecta el header Cf-Access-Jwt-Assertion.
 *   2. Acá se VERIFICA ese JWT (firma RS256 contra las llaves públicas del
 *      equipo de Access, audiencia, emisor, vencimiento) y que el email esté
 *      en ADMIN_EMAILS. No basta con que el header exista: el dominio
 *      *.pages.dev del proyecto NO pasa por Access, y sin esta verificación
 *      el portal quedaría abierto por esa puerta.
 *
 * Variables (Cloudflare Pages → Settings → Variables):
 *   CF_ACCESS_TEAM_DOMAIN  p.ej. "miequipo.cloudflareaccess.com"
 *   CF_ACCESS_AUD          "Application Audience (AUD) Tag" de la app de
 *                          Access; varias separadas por coma
 *   ADMIN_EMAILS           emails permitidos, separados por coma
 * Si falta cualquiera → nadie entra (en producción).
 *
 * En `next dev` (NODE_ENV !== 'production') se deja pasar sin Access, para
 * poder trabajar local — mismo criterio que la ruta /api/dev/generate-pdf.
 *
 * Sin dependencias: Web Crypto (disponible en el runtime edge de Cloudflare).
 */

export interface AdminUser {
  email: string
}

const JWT_HEADER = 'cf-access-jwt-assertion'
const JWKS_TTL_MS = 10 * 60 * 1000

let jwksCache: { domain: string; keys: Map<string, CryptoKey>; fetchedAt: number } | null = null

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function b64urlToJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T
}

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }

/** Inyectable en tests. En producción baja las llaves del equipo de Access. */
export type JwksFetcher = (domain: string) => Promise<Jwk[]>

const defaultFetcher: JwksFetcher = async (domain) => {
  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`JWKS de Access respondió ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  return body.keys ?? []
}

async function keyFor(domain: string, kid: string, fetcher: JwksFetcher, now: number): Promise<CryptoKey | null> {
  const fresh = jwksCache && jwksCache.domain === domain && now - jwksCache.fetchedAt < JWKS_TTL_MS
  if (!fresh || !jwksCache!.keys.has(kid)) {
    const jwks = await fetcher(domain)
    const keys = new Map<string, CryptoKey>()
    for (const jwk of jwks) {
      if (jwk.kty !== 'RSA') continue
      keys.set(jwk.kid, await crypto.subtle.importKey(
        'jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
      ))
    }
    jwksCache = { domain, keys, fetchedAt: now }
  }
  return jwksCache!.keys.get(kid) ?? null
}

export function _resetJwksCacheForTests() { jwksCache = null }

function csv(v: string | undefined): string[] {
  return (v ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

/**
 * Rechazo con motivo en los logs (Cloudflare Pages → Functions → logs en
 * tiempo real). Nunca se loguea el token; el AUD y el email del token no son
 * secretos y son justo lo que hace falta para corregir la configuración.
 */
function deny(reason: string): null {
  console.warn(`[admin] acceso denegado: ${reason}`)
  return null
}

export interface AdminAuthConfig {
  teamDomain?: string
  audiences: string[]
  emails: string[]
  allowDevBypass: boolean
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): AdminAuthConfig {
  return {
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''),
    audiences: (env.CF_ACCESS_AUD ?? '').split(',').map(s => s.trim()).filter(Boolean),
    emails: csv(env.ADMIN_EMAILS),
    allowDevBypass: env.NODE_ENV !== 'production',
  }
}

/**
 * Devuelve el admin si la request está autorizada; null si no. Nunca lanza:
 * cualquier error (JWT roto, JWKS caído, config incompleta) = no autorizado.
 */
export async function getAdmin(
  headers: Headers,
  config: AdminAuthConfig = configFromEnv(),
  deps: { fetcher?: JwksFetcher; now?: number } = {},
): Promise<AdminUser | null> {
  const token = headers.get(JWT_HEADER)

  if (!token) {
    return config.allowDevBypass ? { email: 'dev@localhost' } : deny('la request no trae el header de Cloudflare Access — ¿la ruta está cubierta por la app "Pixia Admin" o se entró por *.pages.dev?')
  }
  if (!config.teamDomain || config.audiences.length === 0 || config.emails.length === 0) {
    console.error('[admin] Falta CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD o ADMIN_EMAILS — acceso denegado')
    return null
  }

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return deny('el token no tiene formato JWT')
    const [h, p, s] = parts
    const header = b64urlToJson<{ alg?: string; kid?: string }>(h)
    if (header.alg !== 'RS256' || !header.kid) return deny(`algoritmo inesperado (${header.alg})`)

    const now = deps.now ?? Date.now()
    const key = await keyFor(config.teamDomain, header.kid, deps.fetcher ?? defaultFetcher, now)
    if (!key) return deny(`ninguna llave de ${config.teamDomain} coincide con el token — ¿CF_ACCESS_TEAM_DOMAIN es el correcto?`)

    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`),
    )
    if (!ok) return deny('firma inválida')

    const claims = b64urlToJson<{ aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string }>(p)
    const nowSec = Math.floor(now / 1000)
    if (typeof claims.exp !== 'number' || claims.exp < nowSec) return deny('token vencido')
    if (typeof claims.nbf === 'number' && claims.nbf > nowSec + 60) return deny('token todavía no válido')
    if (claims.iss !== `https://${config.teamDomain}`) return deny(`emisor ${claims.iss} no coincide con CF_ACCESS_TEAM_DOMAIN=${config.teamDomain}`)
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!auds.some(a => a && config.audiences.includes(a))) return deny(`el AUD del token (${auds.join(', ')}) no está en CF_ACCESS_AUD — copiar el de la app "Pixia Admin"`)

    const email = claims.email?.toLowerCase()
    if (!email || !config.emails.includes(email)) return deny(`el email ${email ?? '(vacío)'} no está en ADMIN_EMAILS`)
    return { email }
  } catch (err) {
    console.error('[admin] Error verificando JWT de Access:', err)
    return null
  }
}

/**
 * Para páginas y rutas: el layout de /admin ya corta, pero en el App Router
 * layout y página se renderizan en paralelo — cada página/ruta vuelve a
 * chequear para que ninguna consulta corra sin autorización.
 */
export async function isAdminRequest(headers: Headers): Promise<boolean> {
  return (await getAdmin(headers)) !== null
}
