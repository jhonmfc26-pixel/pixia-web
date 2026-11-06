import type { MetadataRoute } from 'next'

// Solo páginas públicas. Sumar aquí las landings por ocasión cuando existan.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://pixiaa.com/', changeFrequency: 'weekly', priority: 1 },
  ]
}
