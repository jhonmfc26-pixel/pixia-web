/**
 * Días hábiles en Colombia (lunes a viernes, sin festivos) — para los plazos
 * legales de respuesta a PQR (15 días hábiles, Ley 1480) y a consultas de
 * datos personales (10 días hábiles, Ley 1581).
 *
 * Festivos según la Ley 51 de 1983 ("Ley Emiliani"): unos son fijos, otros se
 * corren al lunes siguiente y otros dependen de la Pascua.
 */

/** Domingo de Pascua (algoritmo anónimo gregoriano). Devuelve [mes 1-12, día]. */
function easter(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}

/** Fechas en UTC a medianoche: se trabaja con días de calendario, sin horas. */
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
const key = (date: Date) => date.toISOString().slice(0, 10)

/** Si no cae en lunes, se corre al lunes siguiente. */
function nextMonday(date: Date): Date {
  const dow = date.getUTCDay() // 0 domingo … 1 lunes
  return dow === 1 ? date : addDays(date, (8 - dow) % 7)
}

const cache = new Map<number, Set<string>>()

/** Festivos de un año como 'YYYY-MM-DD'. */
export function colombianHolidays(year: number): Set<string> {
  const hit = cache.get(year)
  if (hit) return hit
  const [em, ed] = easter(year)
  const e = utc(year, em, ed)
  const days: Date[] = [
    // Fijos
    utc(year, 1, 1), utc(year, 5, 1), utc(year, 7, 20), utc(year, 8, 7), utc(year, 12, 8), utc(year, 12, 25),
    // Se corren al lunes
    ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => nextMonday(utc(year, m, d))),
    // Semana Santa
    addDays(e, -3), addDays(e, -2),
    // Ascensión, Corpus Christi y Sagrado Corazón (ya trasladados a lunes)
    addDays(e, 43), addDays(e, 64), addDays(e, 71),
  ]
  const set = new Set(days.map(key))
  cache.set(year, set)
  return set
}

export function isBusinessDay(date: Date): boolean {
  const dow = date.getUTCDay()
  if (dow === 0 || dow === 6) return false
  return !colombianHolidays(date.getUTCFullYear()).has(key(date))
}

/** Fecha de hoy en Bogotá (UTC-5, sin horario de verano) como fecha UTC a medianoche. */
export function bogotaDate(at: Date = new Date()): Date {
  const local = new Date(at.getTime() - 5 * 3_600_000)
  return utc(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate())
}

/**
 * Último día del plazo: se cuenta desde el día hábil SIGUIENTE al de la
 * radicación (como en los términos legales), `n` días hábiles.
 */
export function addBusinessDays(start: Date, n: number): Date {
  let d = start
  let left = n
  while (left > 0) {
    d = addDays(d, 1)
    if (isBusinessDay(d)) left--
  }
  return d
}

/** Días hábiles que faltan desde `today` hasta `deadline` (negativo si ya venció). */
export function businessDaysUntil(today: Date, deadline: Date): number {
  if (key(today) === key(deadline)) return 0
  const sign = deadline > today ? 1 : -1
  let d = today
  let count = 0
  while (key(d) !== key(deadline)) {
    d = addDays(d, sign)
    if (isBusinessDay(d)) count += sign
  }
  return count
}

export function formatDateEs(date: Date): string {
  return date.toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
