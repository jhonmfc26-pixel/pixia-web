/**
 * De dónde puede descargar Chromium al armar un PDF: solo el almacenamiento de
 * Pixia (fotos, arte de portadas, logo) y Google Fonts. La dirección de cada
 * foto viene del álbum, que escribe el navegador del cliente; sin esta lista,
 * un álbum podría hacer que el contenedor descargue de cualquier servidor.
 *
 * Para permitir otro dominio sin tocar código (por ejemplo si el almacenamiento
 * cambia de dirección): PRINT_EXTRA_HOSTS="a.ejemplo.com,b.ejemplo.com".
 */
/**
 * Dominios del almacenamiento público de Pixia (bucket de R2 de fotos y arte
 * de portadas). El primero es la dirección pública del bucket, la que va hoy
 * en cada foto (NEXT_PUBLIC_R2_PUBLIC_URL de la web). El segundo, el dominio
 * propio, por si se conecta al bucket más adelante.
 */
const PIXIA_ASSET_HOSTS = ['pub-aa3db0435cb645cfbb71c0b49a045b28.r2.dev', 'assets.pixiaa.com']
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

export function allowedPrintHosts(baseUrl: string, extra: string | undefined = process.env.PRINT_EXTRA_HOSTS): Set<string> {
  const hosts = new Set<string>([...PIXIA_ASSET_HOSTS, ...FONT_HOSTS])
  try { hosts.add(new URL(baseUrl).hostname.toLowerCase()) } catch { /* baseUrl inválida: quedan los fijos */ }
  for (const h of (extra ?? '').split(',')) if (h.trim()) hosts.add(h.trim().toLowerCase())
  return hosts
}

/** ¿Se puede pedir esta dirección? Lo que va dentro del propio documento (data:, blob:, about:) siempre. */
export function isAllowedPrintUrl(url: string, hosts: Set<string>): boolean {
  let parsed: URL
  try { parsed = new URL(url) } catch { return false }
  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:' || parsed.protocol === 'about:') return true
  return parsed.protocol === 'https:' && hosts.has(parsed.hostname.toLowerCase())
}

/** ¿Es del almacenamiento de Pixia (fotos, arte, logo)? Esas son las que se reducen para imprimir. */
export function isPixiaAsset(url: string, extra: string | undefined = process.env.PRINT_EXTRA_HOSTS): boolean {
  let parsed: URL
  try { parsed = new URL(url) } catch { return false }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  if (PIXIA_ASSET_HOSTS.includes(host)) return true
  return (extra ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean).includes(host)
}
