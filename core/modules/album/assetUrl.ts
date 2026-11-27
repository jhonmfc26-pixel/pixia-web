/**
 * Dirección pública de las fotos.
 *
 * Al principio el bucket de fotos se publicó por su dominio de desarrollo de
 * R2 (`pub-….r2.dev`). Cloudflare lo dice claro: ese dominio tiene límite de
 * peticiones, no pasa por la caché y es solo para desarrollo. Con muchas
 * personas abriendo álbumes de 100 fotos a la vez, empiezan a fallar fotos.
 *
 * El dominio de producción es el que diga NEXT_PUBLIC_R2_PUBLIC_URL
 * (`https://assets.pixiaa.com`, conectado al mismo bucket). Las fotos ya
 * subidas quedaron guardadas con la dirección vieja: al leer un álbum se
 * cambian al dominio de producción (mismo archivo, misma ruta). Mientras
 * NEXT_PUBLIC_R2_PUBLIC_URL siga apuntando a r2.dev, no se cambia nada.
 */

/** Dominio de desarrollo del bucket de fotos de Pixia. */
export const LEGACY_R2_DEV_HOST = 'pub-aa3db0435cb645cfbb71c0b49a045b28.r2.dev'

function productionOrigin(base: string | undefined): string | null {
  if (!base) return null
  try {
    const u = new URL(base)
    if (u.protocol !== 'https:' || u.hostname === LEGACY_R2_DEV_HOST || u.hostname.endsWith('.r2.dev')) return null
    return u.origin
  } catch {
    return null
  }
}

/** La misma foto, servida por el dominio de producción si ya está configurado. */
export function canonicalAssetUrl(url: string, base: string | undefined = process.env.NEXT_PUBLIC_R2_PUBLIC_URL): string {
  if (!url) return url
  const origin = productionOrigin(base)
  if (!origin) return url
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.hostname !== LEGACY_R2_DEV_HOST) return url
    return origin + u.pathname + u.search
  } catch {
    return url
  }
}
