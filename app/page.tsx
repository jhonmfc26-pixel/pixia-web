import StudioHome from '@/components/studio/StudioHome'
import Footer from '@/components/home/Footer'
import { FORMATS } from '@/lib/formats'


// Datos estructurados para Google: quién es Pixia y qué vende (precio en COP).
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Pixia',
      url: 'https://pixiaa.com',
      logo: 'https://pixiaa.com/icon.png',
    },
    // Un producto por formato que ya se vende (mismos precios que la home).
    ...FORMATS.filter(f => f.available).map(f => ({
      '@type': 'Product',
      name: `Álbum Pixia ${f.name} ${f.sizeLabel} tapa dura`,
      description: `Álbum de fotos impreso de tapa dura, ${f.sizeLabel}, diseñado automáticamente a partir de tus fotos. Ideal para ${f.use.toLowerCase()}.`,
      image: 'https://pixiaa.com/og-pixia.jpg',
      brand: { '@type': 'Brand', name: 'Pixia' },
      offers: {
        '@type': 'Offer',
        price: String(f.priceCop),
        priceCurrency: 'COP',
        availability: 'https://schema.org/InStock',
        areaServed: 'CO',
        url: 'https://pixiaa.com/#formatos',
      },
    })),
  ],
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <StudioHome />
      <Footer variant="light" />
    </>
  )
}
