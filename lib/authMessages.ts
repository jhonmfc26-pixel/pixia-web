/**
 * Mensajes en español para los errores de inicio de sesión de Supabase (que
 * llegan en inglés). Puro, para poder probarlo.
 */
export function authErrorMessage(raw: string | undefined | null): string {
  const m = (raw ?? '').toLowerCase()
  if (/expired|invalid/.test(m) && /token|otp|code|link/.test(m)) return 'El código no es válido o ya venció. Revisa que sea el del último correo, o pide uno nuevo.'
  const wait = m.match(/after (\d+) seconds?/)
  if (wait) return `Por seguridad, espera ${wait[1]} segundos antes de pedir otro correo.`
  if (/rate limit|too many/.test(m)) return 'Pediste muchos correos seguidos. Espera unos minutos e inténtalo de nuevo.'
  if (/signup|not allowed|not found/.test(m)) return 'No encontramos una cuenta con ese correo.'
  if (/invalid.*email|email.*invalid/.test(m)) return 'Ese correo no parece válido. Revísalo.'
  if (/fetch|network|failed to/.test(m)) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'
  return 'No pudimos completar el acceso. Inténtalo de nuevo en un momento.'
}

/** Lo que la persona escribe → solo dígitos (pega «123 456» o «123-456» sin problema). */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 10)
}

/** Supabase usa códigos de 6 dígitos por defecto (configurable hasta 10). */
export const isCompleteCode = (code: string) => /^\d{6,10}$/.test(code)
