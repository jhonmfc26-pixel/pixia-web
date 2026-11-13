/**
 * De qué ambiente de Wompi son las llaves puestas (producción o sandbox) y a
 * qué API se consulta. Nunca devuelve el valor de una llave: solo si está y de
 * qué ambiente es (lo dice su prefijo).
 */
type Env = Record<string, string | undefined>

export const WOMPI_SANDBOX_URL = 'https://sandbox.wompi.co/v1'
export const WOMPI_PRODUCTION_URL = 'https://production.wompi.co/v1'

type WompiEnv = 'prod' | 'test' | 'missing' | 'unknown'

/** Las cuatro llaves de Wompi: cada una dice en su prefijo de qué ambiente es. */
const WOMPI_KEYS = [
  { env: 'NEXT_PUBLIC_WOMPI_PUBLIC_KEY', label: 'llave pública', prod: 'pub_prod_', test: 'pub_test_' },
  { env: 'WOMPI_PRIVATE_KEY', label: 'llave privada', prod: 'prv_prod_', test: 'prv_test_' },
  { env: 'WOMPI_EVENTS_SECRET', label: 'secreto de eventos', prod: 'prod_events_', test: 'test_events_' },
  { env: 'WOMPI_INTEGRITY_SECRET', label: 'secreto de integridad', prod: 'prod_integrity_', test: 'test_integrity_' },
] as const

function keyEnv(value: string | undefined, k: (typeof WOMPI_KEYS)[number]): WompiEnv {
  const v = value?.trim()
  if (!v) return 'missing'
  if (v.startsWith(k.prod)) return 'prod'
  if (v.startsWith(k.test)) return 'test'
  return 'unknown'
}

/**
 * A qué API de Wompi se le pregunta por una transacción. Sigue a la llave
 * privada: con llave de producción se consulta producción aunque nadie haya
 * puesto WOMPI_API_URL (antes, sin esa variable, se consultaba sandbox y
 * ningún pago real quedaba aprobado). WOMPI_API_URL, si está, manda.
 */
export function wompiApiUrl(env: Env = process.env): string {
  const explicit = env.WOMPI_API_URL?.trim().replace(/\/+$/, '')
  if (explicit) return explicit
  return env.WOMPI_PRIVATE_KEY?.trim().startsWith('prv_prod_') ? WOMPI_PRODUCTION_URL : WOMPI_SANDBOX_URL
}

export interface WompiSetup {
  /** produccion: cobra de verdad · pruebas: sandbox · mal: no va a funcionar. */
  mode: 'produccion' | 'pruebas' | 'mal'
  problems: string[]
}

export function wompiSetup(env: Env = process.env): WompiSetup {
  const found = WOMPI_KEYS.map(k => ({ k, is: keyEnv(env[k.env], k) }))
  const problems: string[] = []
  for (const { k, is } of found) {
    if (is === 'missing') problems.push(`Falta ${k.env} (${k.label}).`)
    if (is === 'unknown') problems.push(`${k.env} no parece una ${k.label} de Wompi: debería empezar por ${k.prod} o ${k.test}.`)
  }
  const envs = new Set(found.map(f => f.is).filter(e => e === 'prod' || e === 'test'))
  if (envs.size === 2) {
    const of = (e: WompiEnv) => found.filter(f => f.is === e).map(f => f.k.env).join(', ')
    problems.push(`Hay llaves de los dos ambientes mezcladas. De producción: ${of('prod')}. De pruebas: ${of('test')}.`)
  }
  const keysAre = envs.size === 1 ? [...envs][0] : null
  const api = wompiApiUrl(env)
  const apiIs = /sandbox/i.test(api) ? 'test' : /production/i.test(api) ? 'prod' : 'unknown'
  if (keysAre && apiIs !== 'unknown' && apiIs !== keysAre) {
    problems.push(`WOMPI_API_URL apunta a ${apiIs === 'prod' ? 'producción' : 'sandbox'} pero las llaves son de ${keysAre === 'prod' ? 'producción' : 'pruebas'}: los pagos no se van a aprobar. Borra WOMPI_API_URL o corrígela.`)
  }
  if (problems.length > 0) return { mode: 'mal', problems }
  return { mode: keysAre === 'prod' ? 'produccion' : 'pruebas', problems: [] }
}
