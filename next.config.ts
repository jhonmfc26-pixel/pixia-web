import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // max-age=1 año. Actualizar a includeSubDomains cuando todos los subdominios soporten HTTPS.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  // Pixia no usa cámara ni micrófono. La ubicación queda
  // permitida solo para el propio sitio (mini mapa del checkout, pendiente).
  // «payment» no se restringe: el widget de Wompi (iframe) puede usarlo.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), usb=(), geolocation=(self)' },
  // Content-Security-Policy: pendiente a propósito. El sitio carga el widget
  // de Wompi, Supabase, R2 y scripts en línea de Next; una política mal
  // ajustada rompe el pago sin avisar. Se agrega con modo «solo reportar»
  // después del lanzamiento (auditoría 2026-11-13, M9).
]

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

// Bindings de Cloudflare (KV, etc.) también en `next dev`.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
initOpenNextCloudflareForDev()
