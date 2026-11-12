/**
 * Fuentes de las portadas, dedicatorias y títulos: una sola URL de Google
 * Fonts para la web (<link> en app/layout.tsx) y para el PDF (@import en
 * core/modules/print/renderPrintHtml.ts). Así la portada se ve en pantalla
 * con la misma letra que sale impresa.
 *
 * Antes estaba como @import dentro de app/globals.css, pero el build de
 * Tailwind/Next lo descartaba: en la web las portadas salían con la letra de
 * respaldo del sistema y solo el PDF tenía la tipografía real (2026-11-12).
 *
 * Si se agrega una fuente a COVER_FONTS (coverDesign.ts) o a las de
 * dedicatoria, va acá.
 */
export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&family=Parisienne&family=Pinyon+Script&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Bebas+Neue&family=Anton&family=DM+Serif+Display&family=Fraunces:wght@400;500;600&family=Abril+Fatface&family=Josefin+Sans:wght@300;400;600&family=Caveat:wght@400;600&display=swap'
