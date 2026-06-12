interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

const LIMITS: Record<string, number> = {
  '/api/editorial': 5,
  '/api/upload': 120,
  '/api/orders': 10,
}

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

export async function rateLimit(
  request: Request,
  path: string
): Promise<Response | null> {
  const kv = await getKV()
  if (!kv) return null

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const limit = LIMITS[path] ?? 100
  const key = `ratelimit:${ip}:${path}`

  const stored = await kv.get(key)
  const parsed = stored ? parseInt(stored, 10) : 0
  const currentCount = (isNaN(parsed) ? 0 : parsed) + 1

  if (currentCount > limit) {
    return new Response(
      JSON.stringify({ error: 'Too Many Requests', retryAfter: 60 }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Path': path,
        },
      }
    )
  }

  await kv.put(key, currentCount.toString(), { expirationTtl: 60 })
  return null
}
