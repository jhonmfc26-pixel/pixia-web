interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

/**
 * Límite de peticiones por IP y por minuto, con Cloudflare KV.
 *
 * Reglas de diseño (auditoría 2026-11-13, C4):
 *  - NUNCA rompe la petición: si KV falla (límite diario de escrituras, 429
 *    por escribir la misma clave dos veces en un segundo, caída), se deja pasar.
 *    Un limitador caído no puede tumbar la subida de fotos ni el pago.
 *  - Ventana fija de un minuto (la clave lleva el minuto): el contador se
 *    reinicia solo, aunque sigan llegando peticiones.
 *  - Las rutas de mucho volumen no escriben en cada petición: cuentan por
 *    muestreo (1 de cada `sample` peticiones suma `sample`). Un álbum de 100
 *    fotos son ~10 escrituras en vez de 100 (KV gratis admite 1.000 al día) y
 *    casi nunca dos en el mismo segundo.
 */
interface Rule { perMinute: number; sample: number }

const RULES: Record<string, Rule> = {
  // Un álbum admite 100 fotos (más reintentos) y en redes móviles varias
  // personas comparten IP: el tope solo frena abuso automatizado.
  '/api/upload': { perMinute: 600, sample: 10 },
  '/api/orders': { perMinute: 10, sample: 1 },
  '/api/editorial': { perMinute: 5, sample: 1 },
  '/api/pqr': { perMinute: 5, sample: 1 },
}
const DEFAULT_RULE: Rule = { perMinute: 100, sample: 1 }

// En dev/build no hay contexto Cloudflare; getRequestContext() throws → null → sin rate limiting
async function getKV(): Promise<KVNamespace | null> {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const { env } = getRequestContext()
    return ((env as Record<string, unknown>).RATE_LIMIT_KV as KVNamespace) ?? null
  } catch {
    return null
  }
}

export async function rateLimit(request: Request, path: string): Promise<Response | null> {
  const kv = await getKV()
  if (!kv) return null
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  return checkRateLimit(kv, ip, path)
}

/** Lógica del limitador, separada para poder probarla con un KV de mentira. */
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  path: string,
  opts: { now?: number; random?: () => number } = {},
): Promise<Response | null> {
  const rule = RULES[path] ?? DEFAULT_RULE
  const minute = Math.floor((opts.now ?? Date.now()) / 60_000)
  const key = `ratelimit:${ip}:${path}:${minute}`

  try {
    const stored = await kv.get(key)
    const parsed = stored ? parseInt(stored, 10) : 0
    const count = isNaN(parsed) ? 0 : parsed

    if (count >= rule.perMinute) {
      return new Response(
        JSON.stringify({ error: 'Demasiadas peticiones. Espera un minuto e inténtalo de nuevo.', retryAfter: 60 }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': String(rule.perMinute),
            'X-RateLimit-Path': path,
          },
        },
      )
    }

    const counts = rule.sample <= 1 || (opts.random ?? Math.random)() < 1 / rule.sample
    // TTL mínimo de KV: 60 s. Con 120 la clave sobrevive a su minuto y se borra sola.
    if (counts) await kv.put(key, String(count + rule.sample), { expirationTtl: 120 })
  } catch (err) {
    console.error('[rateLimit] KV falló, se deja pasar la petición:', err instanceof Error ? err.message : err)
  }
  return null
}
