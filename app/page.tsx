import Hero from "@/components/home/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import Showcase from "@/components/home/Showcase";
import Features from "@/components/home/Features";
import Pricing from "@/components/home/Pricing";
import CTA from "@/components/home/CTA";
import Footer from "@/components/home/Footer";
import Header from '@/components/home/Header'

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
    {
      '@type': 'Product',
      name: 'Álbum Pixia 30×30 cm tapa dura',
      description: 'Álbum de fotos impreso de tapa dura, 30×30 cm, diseñado automáticamente a partir de tus fotos. 20 páginas incluidas.',
      image: 'https://pixiaa.com/og-pixia.jpg',
      brand: { '@type': 'Brand', name: 'Pixia' },
      offers: {
        '@type': 'Offer',
        price: '250000',
        priceCurrency: 'COP',
        availability: 'https://schema.org/InStock',
        areaServed: 'CO',
        url: 'https://pixiaa.com/#precios',
      },
    },
  ],
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <Header />
      <Hero />
      <Showcase />
      <HowItWorks />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
    </>
  )
}
