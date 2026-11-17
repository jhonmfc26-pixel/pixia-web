/**
 * Comparar dos textos (firmas, secretos) sin que el tiempo de respuesta
 * delate cuántos caracteres coinciden. `===` corta en el primer carácter
 * distinto, y midiendo tiempos se puede adivinar una firma poco a poco.
 *
 * Sirve en el runtime edge de Cloudflare (sin node:crypto): recorre siempre
 * el texto completo.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}
