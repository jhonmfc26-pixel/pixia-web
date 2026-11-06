import "./globals.css";
import type { Metadata, Viewport } from "next";

const SITE_URL = "https://pixiaa.com";
const DESCRIPTION =
  "Sube tus fotos y Pixia diseña un álbum impreso de tapa dura, 30×30 cm, listo para recibir en tu casa. Para bodas, viajes, aniversarios y familia. Envío a toda Colombia.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pixia — Álbumes de fotos impresos, diseñados por ti en minutos",
    template: "%s · Pixia",
  },
  description: DESCRIPTION,
  applicationName: "Pixia",
  keywords: ["álbum de fotos", "fotolibro", "álbum de fotos impreso", "libro de fotos", "álbum de boda", "álbum de viaje", "Colombia"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: SITE_URL,
    siteName: "Pixia",
    title: "Tus fotos merecen ser un libro — Pixia",
    description: DESCRIPTION,
    images: [{ url: "/og-pixia.jpg", width: 1200, height: 630, alt: "Pixia — Tus fotos merecen ser un libro" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tus fotos merecen ser un libro — Pixia",
    description: DESCRIPTION,
    images: ["/og-pixia.jpg"],
  },
};

// viewportFit:'cover' es lo que hace que env(safe-area-inset-*) devuelva algo
// distinto de 0 en iOS (notch/home indicator) — sin esto, los paneles fijos
// del editor que usan env(safe-area-inset-bottom) no tendrían ningún efecto real.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO">
      <body className="bg-gradient-to-br from-black via-zinc-900 to-black text-white min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
