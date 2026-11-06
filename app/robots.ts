import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Privado o interno: flujo de creación, álbumes de clientes, pagos, admin.
      disallow: ['/create', '/book/', '/checkout', '/mis-albumes', '/auth', '/admin', '/api/', '/dev'],
    },
    sitemap: 'https://pixiaa.com/sitemap.xml',
  }
}
