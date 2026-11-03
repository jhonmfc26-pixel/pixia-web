/**
 * Feature flag — Fase B1 de "Ritmo Pixia". Decide si el motor de layouts usa
 * el registry base (comportamiento de hoy) o el catálogo nuevo (31 layouts,
 * 3 tiers de densidad, migrado desde ritmoPixia.draft.ts).
 *
 * NEXT_PUBLIC_* porque registry.ts es isomórfico — lo importan tanto
 * componentes 'use client' (SpreadFaces.tsx) como código de runtime edge
 * (pageEngine.ts vía app/api/*, incluyendo el route de generación de PDF) —
 * necesita estar inlineado en ambos bundles en build time, no solo
 * disponible server-side.
 *
 * Se evalúa una sola vez al cargar el módulo (no es un toggle en vivo — es
 * una decisión de build/deploy, como cualquier NEXT_PUBLIC_*). Default OFF:
 * sin la env var seteada, el comportamiento es exactamente el de hoy.
 *
 * Activar: NEXT_PUBLIC_RITMO_LAYOUTS=true en el entorno (.env.local para
 * probar local, variable de entorno del proyecto en Cloudflare Pages para
 * activarlo en un deploy). Desactivar: quitar la variable o ponerla en
 * cualquier otro valor.
 */
export const RITMO_LAYOUTS_ENABLED = process.env.NEXT_PUBLIC_RITMO_LAYOUTS === 'true'
