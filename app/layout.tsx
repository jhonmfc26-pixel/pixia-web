import "./globals.css";
// Fuentes de portadas y títulos servidas desde el propio sitio (ver el archivo).
import "./cover-fonts.css";
import type { Metadata, Viewport } from "next";

const SITE_URL = "https://pixiaa.com";
const DESCRIPTION =
  "Sube tus fotos y Pixia diseña un álbum impreso de tapa dura, en 30×30, 20×20 o 21×28 cm, listo para recibir en tu casa. Para bodas, viajes, aniversarios, niños y familia. Envío a toda Colombia.";

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
  // En public/ y no como app/icon.png: next-on-pages trata los íconos de app/
  // como rutas del servidor y la build de Cloudflare falla.
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
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

/**
 * Página vieja después de un despliegue. Cloudflare solo sirve los archivos
 * (estilos y JS, con nombre por versión) del despliegue actual. Una página
 * abierta desde antes, o que el navegador restaura de su copia (Chrome en
 * iPhone lo hace al reabrir una pestaña), pide archivos que ya no existen:
 * queda sin estilos y sin responder. Si falla un archivo propio, se recarga
 * la página una vez (como mucho una por minuto, para no entrar en bucle).
 */
const STALE_PAGE_GUARD = `(function(){
  var KEY = 'pixia_recarga_despliegue';
  function reloadOnce() {
    try {
      var last = +sessionStorage.getItem(KEY) || 0;
      if (Date.now() - last < 60000) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (e) { return; }
    location.reload();
  }
  function ours(u) { return typeof u === 'string' && u.indexOf('/_next/static/') !== -1; }
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.tagName === 'LINK' || t.tagName === 'SCRIPT') && ours(t.href || t.src)) reloadOnce();
  }, true);
  addEventListener('unhandledrejection', function (e) {
    var m = String((e.reason && (e.reason.message || e.reason.name)) || '');
    if (/ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|Importing a module script failed/i.test(m)) reloadOnce();
  });
  addEventListener('load', function () {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) if (ours(links[i].href) && !links[i].sheet) return reloadOnce();
  });
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO">
      <head>
        <script dangerouslySetInnerHTML={{ __html: STALE_PAGE_GUARD }} />
      </head>
      <body className="bg-gradient-to-br from-black via-zinc-900 to-black text-white min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
