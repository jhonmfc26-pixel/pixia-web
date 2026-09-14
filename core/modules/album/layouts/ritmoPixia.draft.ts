import type { LayoutSchema } from './types'

/**
 * DRAFT — catálogo "Ritmo Pixia" (Fase A de diseño, documento aprobado
 * "juntos" antes de este archivo). Esto NO es el registry de producción:
 * es un set de datos para /dev/ritmo, la herramienta de revisión visual.
 *
 * No lo importa nada de core/modules/album/pageEngine.ts, groupPhotos.ts,
 * segmentChapter.ts ni layoutFit.ts — el motor de selección real sigue
 * usando exclusivamente ./registry.ts. Cuando el catálogo se apruebe acá,
 * la migración a producción es una tarea aparte (mover/fusionar con
 * registry.ts, resolver los puntos marcados como "Fase B" abajo).
 *
 * Área y AR de cada slot (`areaPercent`/`slotArs`) están precalculados a
 * mano con la misma fórmula que usa layoutFit.ts (`_slotGeoms`, página
 * cuadrada) — no se reimplementa ese parser acá a propósito, para no rozar
 * el motor real ni siquiera de forma read-only. Si un número de acá difiere
 * del real una vez migrado, gana el cálculo real — estos son valores de
 * diseño, verificados una vez, no recalculados en cada render.
 *
 * `slotArs` es lo que /dev/ritmo usa para elegir la foto de muestra IDEAL
 * de cada slot (AR de la foto ≈ AR del slot) — mismo orden que `slots`.
 */

export type DensityTier = 'full-bleed' | 'equilibrado' | 'aire'

export interface DraftLayoutSchema extends LayoutSchema {
  /** Densidad — para el motor de ritmo de Fase B (alternar tiers). */
  tier: DensityTier
  /** % real de página cubierto por foto (100 − aire). Precalculado, ver cabecera del archivo. */
  areaPercent: number
  /** AR real de cada slot, mismo orden que `slots`. Precalculado, ver cabecera del archivo. */
  slotArs: readonly number[]
  /** Momento narrativo al que sirve — etiqueta corta. */
  role: string
  /** Guía concreta y accionable: cuándo usarlo + qué tipo de foto pedirle, con ejemplo. */
  idealMoment: string
  /** Índice del slot dominante (por área), si lo hay — para resaltarlo "H" en el preview. */
  heroSlotIndex?: number
  /** No existe en core/modules/album/layouts/registry.ts hoy. */
  isNew?: boolean
  /** Reemplaza/jubila a este id del registry de producción (ver documento "Qué jubilar"). */
  replacesId?: string
}

export const RITMO_PIXIA_DRAFT: readonly DraftLayoutSchema[] = [

  // ══════════════════════════════ 1 FOTO ═══════════════════════════════
  {
    id: 'single', name: 'Single', photoCount: 1,
    grid: { columns: '1fr', rows: '1fr', areas: '"a"' },
    slots: ['a'], slotArs: [1.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Declaración — la foto manda sola, sin nada alrededor.',
    idealMoment: 'Un solo golpe visual, casi cuadrado — el retrato o la escena que resume el capítulo.',
  },
  {
    id: 'portrait', name: 'Portrait', photoCount: 1,
    grid: { columns: '0.08fr 0.84fr 0.08fr', rows: '1fr', areas: '". a ."' },
    slots: ['a'], slotArs: [0.84], hasAir: true,
    tier: 'equilibrado', areaPercent: 84,
    role: 'Retrato con respiro leve — pide algo de aire, no una pausa marcada.',
    idealMoment: 'Una vertical suave (retrato 4:5) que quiere aire sin volverse el centro de atención de la página.',
  },
  {
    id: 'solo-portrait-air', name: 'Solo portrait air', photoCount: 1,
    grid: { columns: '0.14fr 0.72fr 0.14fr', rows: '1fr', areas: '". a ."' },
    slots: ['a'], slotArs: [0.72], hasAir: true,
    tier: 'aire', areaPercent: 72,
    role: 'Pausa vertical — un detalle que necesita margen para respirar del todo.',
    idealMoment: 'Un detalle vertical y ceñido — un objeto, una mano, un gesto — algo que pide quietud alrededor.',
  },
  {
    id: 'solo-landscape-air', name: 'Solo landscape air', photoCount: 1,
    grid: { columns: '1fr', rows: '0.143fr 0.714fr 0.143fr', areas: '"." "a" "."' },
    slots: ['a'], slotArs: [1.40], hasAir: true,
    tier: 'aire', areaPercent: 71,
    role: 'Pausa horizontal — paisaje o escena amplia, enmarcada con calma.',
    idealMoment: 'Un paisaje horizontal amplio y calmo — el cielo, el horizonte, el "after" de una escena.',
  },
  {
    id: 'hero-spread', name: 'Hero spread', photoCount: 1, scope: 'spread', disableMargin: true,
    grid: { columns: '1fr', rows: '1fr', areas: '"a"' },
    slots: ['a'], slotArs: [2.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Panorámica heroica — cruza el lomo.',
    idealMoment: 'Una panorámica real (2:1) — el paisaje que no cabe en una sola página. Sujeto lejos del centro (ver regla de gutter).',
  },

  // ══════════════════════════════ 2 FOTOS ══════════════════════════════
  {
    id: 'stack-2', name: 'Stack 2', photoCount: 2,
    grid: { columns: '1fr', rows: '1fr 1fr', areas: '"a" "b"' },
    slots: ['a', 'b'], slotArs: [2.0, 2.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Secuencia vertical — antes/después apilado, dos horizontales.',
    idealMoment: 'Dos horizontales anchas que cuentan una secuencia — salida y llegada, antes y después.',
  },
  {
    id: 'side-2', name: 'Side 2', photoCount: 2,
    grid: { columns: '1fr 1fr', rows: '1fr', areas: '"a b"' },
    slots: ['a', 'b'], slotArs: [0.5, 0.5],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Díptico ceñido — dos verticales lado a lado, ajuste tenso, sin concesión.',
    idealMoment: 'Dos verticales gemelas y ceñidas — dos personas, dos momentos espejados, lado a lado.',
  },
  {
    id: 'portrait-pair', name: 'Portrait pair', photoCount: 2, isNew: true,
    // Recalibrado — antes innerPadding:'10% (60% área real, muy metido en
    // "aire" para lo que quería ser). Inset asimétrico solo en el eje
    // horizontal (ver regla de diseño: nunca simétrico en los dos ejes o
    // empata en AR con side-2 y queda muerto).
    grid: { columns: '0.05fr 0.425fr 0.05fr 0.425fr 0.05fr', rows: '1fr', areas: '". a . b ."' },
    slots: ['a', 'b'], slotArs: [0.425, 0.425], hasAir: true,
    tier: 'equilibrado', areaPercent: 85,
    role: 'Díptico de verticales con respiro — mismo rol que side-2, más suave.',
    idealMoment: 'El mismo díptico de side-2, para cuando las dos verticales piden un respiro en vez de un ajuste tenso.',
  },
  {
    id: 'duo-portrait-air', name: 'Duo portrait air', photoCount: 2,
    grid: { columns: '1fr 1fr', rows: '0.15fr 0.70fr 0.15fr', areas: '". ." "a b" ". ."' },
    slots: ['a', 'b'], slotArs: [0.714, 0.714], hasAir: true,
    tier: 'aire', areaPercent: 70,
    role: 'Pausa doble vertical — dos retratos que necesitan aire de verdad.',
    idealMoment: 'Dos retratos verticales que necesitan aire real — dos rostros que no compiten por espacio.',
  },
  {
    id: 'duo-landscape-air', name: 'Duo landscape air', photoCount: 2,
    grid: { columns: '0.15fr 0.70fr 0.15fr', rows: '1fr 1fr', areas: '". a ." ". b ."' },
    slots: ['a', 'b'], slotArs: [1.40, 1.40], hasAir: true,
    tier: 'aire', areaPercent: 70,
    role: 'Pausa doble horizontal — dos escenas amplias en calma.',
    idealMoment: 'Dos paisajes horizontales en calma — dos vistas que se acompañan sin apurarse.',
  },
  {
    id: 'diptych-spread', name: 'Diptych spread', photoCount: 2, scope: 'spread', disableMargin: true, isNew: true,
    // A diferencia de hero-spread (1 foto partida en 2 caras con el MISMO
    // photoId), acá son 2 FOTOS DISTINTAS, una por página — Fase B necesita
    // un mecanismo de pageEngine.ts nuevo para esto (hero-spread hoy asume
    // "misma foto en las 2 caras", ver el bloque `scope === 'spread'` en
    // buildPages). No es solo una entrada de registry, es un caso de motor
    // distinto — señalado para no subestimar el esfuerzo de Fase B.
    grid: { columns: '1fr 1fr', rows: '1fr', areas: '"a b"' },
    slots: ['a', 'b'], slotArs: [1.0, 1.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Díptico comparativo a doble página — "entonces/ahora", "antes/después".',
    idealMoment: 'Dos fotos DISTINTAS, casi cuadradas, una por página — "entonces" a la izquierda, "ahora" a la derecha.',
  },

  // ══════════════════════════════ 3 FOTOS ══════════════════════════════
  {
    id: 'grid-3', name: 'Grid 3', photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "a c"' },
    slots: ['a', 'b', 'c'], slotArs: [0.5, 1.0, 1.0], heroSlotIndex: 0,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Hero vertical + dos de soporte — protagonista claro, contexto al lado.',
    idealMoment: 'Una vertical fuerte (0.5) como protagonista + dos cuadradas de apoyo al lado — el momento y su contexto.',
  },
  {
    id: 'hero-2-bottom', name: 'Hero 2 bottom', photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '2fr 1fr', areas: '"a a" "b c"' },
    slots: ['a', 'b', 'c'], slotArs: [1.5, 1.5, 1.5], heroSlotIndex: 0,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Hero horizontal + dos chicas abajo — escena grande, detalles debajo.',
    idealMoment: 'Una horizontal amplia arriba + dos horizontales chicas abajo — la escena y sus dos momentos clave.',
  },
  {
    id: 'trio-row', name: 'Trio row', photoCount: 3,
    grid: { columns: '1fr 1fr 1fr', rows: '1fr', areas: '"a b c"' },
    slots: ['a', 'b', 'c'], slotArs: [0.333, 0.333, 0.333],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Secuencia horizontal — tres momentos en fila, ritmo de contact sheet.',
    idealMoment: '3 fotos MUY altas y angostas en secuencia — la Torre Eiffel, la Torre de Pisa, un árbol alto.',
  },
  {
    id: 'trio-column', name: 'Trio column', photoCount: 3,
    grid: { columns: '1fr', rows: '1fr 1fr 1fr', areas: '"a" "b" "c"' },
    slots: ['a', 'b', 'c'], slotArs: [3.0, 3.0, 3.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Secuencia vertical apilada — tres franjas anchas, lectura de arriba a abajo.',
    idealMoment: '3 fotos MUY panorámicas apiladas — tres vistas de un mismo horizonte, leídas de arriba a abajo.',
  },
  {
    id: 'trio-portrait', name: 'Trio portrait', photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '2fr 1fr', areas: '"a b" "c c"' },
    slots: ['a', 'b', 'c'], slotArs: [0.75, 0.75, 3.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Dos arriba + una ancha abajo — díptico rematado con una horizontal.',
    idealMoment: 'Dos verticales suaves arriba + una panorámica ancha abajo que las remata.',
  },
  {
    id: 'quad-mixed', name: 'Quad mixed', photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a a" "b c"' },
    slots: ['a', 'b', 'c'], slotArs: [2.0, 1.0, 1.0], heroSlotIndex: 0,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Hero horizontal arriba + dos abajo — variante de grid-3 con el protagonista acostado.',
    idealMoment: 'Una horizontal fuerte arriba + dos cuadradas de apoyo abajo — variante acostada de grid-3.',
  },
  {
    id: 'trio-air', name: 'Trio air', photoCount: 3, isNew: true, replacesId: 'trio-portrait-air',
    // Reemplaza trio-portrait-air (54% área — el peor ratio del catálogo
    // actual). Mismo rol, margen retenido a 62%.
    grid: { columns: '1fr 1fr 1fr', rows: '0.19fr 0.62fr 0.19fr', areas: '". . ." "a b c" ". . ."' },
    slots: ['a', 'b', 'c'], slotArs: [0.538, 0.538, 0.538], hasAir: true,
    tier: 'aire', areaPercent: 62,
    role: 'Pausa triple — tres retratos con aire, sin perder más de la mitad de la página.',
    idealMoment: 'Tres retratos verticales que necesitan respirar — un trío que no quiere apretarse.',
  },

  // ══════════════════════════════ 4 FOTOS ══════════════════════════════
  {
    id: 'grid-4', name: 'Grid 4', photoCount: 4,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "c d"' },
    slots: ['a', 'b', 'c', 'd'], slotArs: [1.0, 1.0, 1.0, 1.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Grid uniforme — recap parejo, las 4 fotos con el mismo peso. (Ver nota "en pausa" del documento §3.)',
    idealMoment: 'Cuatro fotos casi cuadradas a peso igual — el recap parejo, sin un protagonista claro.',
  },
  {
    id: 'hero-3-top', name: 'Hero 3 top', photoCount: 4,
    grid: { columns: '1fr 1fr 1fr', rows: '1fr 2fr', areas: '"a b c" "d d d"' },
    slots: ['a', 'b', 'c', 'd'], slotArs: [1.0, 1.0, 1.0, 1.5], heroSlotIndex: 3,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Hero horizontal abajo + tres arriba — el más elegido del catálogo actual (≈60%).',
    idealMoment: 'Una horizontal fuerte abajo + tres cuadradas chicas arriba — el más versátil del catálogo.',
  },
  {
    id: 'hero-3-left', name: 'Hero 3 left', photoCount: 4,
    grid: { columns: '2fr 1fr', rows: '1fr 1fr 1fr', areas: '"a b" "a c" "a d"' },
    slots: ['a', 'b', 'c', 'd'], slotArs: [0.667, 1.0, 1.0, 1.0], heroSlotIndex: 0,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Hero vertical a la izquierda + tres apiladas — el segundo más elegido (≈40%).',
    idealMoment: 'Una vertical fuerte a la izquierda + tres cuadradas chicas apiladas a la derecha.',
  },
  {
    id: 'quad-soft', name: 'Quad soft', photoCount: 4, isNew: true,
    // Inset asimétrico solo horizontal — si fuera simétrico en los 2 ejes
    // empataría en AR con grid-4 (mismo error que portrait/single antes del
    // fix) y quedaría muerto por el mismo motivo.
    grid: { columns: '0.1fr 0.4fr 0.4fr 0.1fr', rows: '1fr 1fr', areas: '". a b ." ". c d ."' },
    slots: ['a', 'b', 'c', 'd'], slotArs: [0.8, 0.8, 0.8, 0.8], hasAir: true,
    tier: 'equilibrado', areaPercent: 80,
    role: 'Grid parejo con margen lateral — el recap de grid-4, con una pausa suave.',
    idealMoment: 'El mismo recap de grid-4, con margen lateral suave — cuatro momentos chicos sin saturar.',
  },

  // ══════════════════════════════ 5 FOTOS ══════════════════════════════
  {
    id: 'mosaic-5', name: 'Mosaic 5', photoCount: 5,
    grid: { columns: '1fr 1fr 1fr', rows: '2fr 1fr', areas: '"a a b" "c d e"' },
    slots: ['a', 'b', 'c', 'd', 'e'], slotArs: [1.0, 0.5, 1.0, 1.0, 1.0], heroSlotIndex: 0,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Mosaico asimétrico — hoy gana 99.5% de las veces por falta de competencia real.',
    idealMoment: 'Una casi-cuadrada protagonista + una vertical y tres cuadradas de apoyo — el mosaico narrativo por defecto.',
  },
  {
    id: 'hero-banner-5', name: 'Hero banner 5', photoCount: 5, isNew: true, replacesId: 'hero-4-grid',
    // Reemplaza hero-4-grid (AR de hero 0.5, casi idéntico al de mosaic-5 —
    // 0.5% de selección real). Perfil de AR deliberadamente distinto.
    grid: { columns: '1fr 1fr 1fr 1fr', rows: '3fr 1fr', areas: '"a a a a" "b c d e"' },
    slots: ['a', 'b', 'c', 'd', 'e'], slotArs: [1.333, 1.0, 1.0, 1.0, 1.0], heroSlotIndex: 0,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Banner horizontal + filmstrip de cuatro cuadradas.',
    idealMoment: 'Una horizontal amplia arriba + un filmstrip de 4 cuadradas abajo — la escena y sus detalles.',
  },
  {
    id: 'grid-5', name: 'Grid 5', photoCount: 5, isNew: true,
    // Full-bleed real (sin celdas '.') — 3 arriba angostas + 2 abajo más
    // anchas, sin desperdiciar área. Distinto en AR de mosaic-5 y
    // hero-banner-5 (verificado, sin empate).
    grid: { columns: '1fr 1fr 1fr 1fr 1fr 1fr', rows: '1fr 1fr', areas: '"a a b b c c" "d d d e e e"' },
    slots: ['a', 'b', 'c', 'd', 'e'], slotArs: [0.667, 0.667, 0.667, 1.0, 1.0],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Recap casi uniforme — cinco fotos a peso parejo, sin protagonista.',
    idealMoment: 'Tres verticales suaves arriba + dos cuadradas más anchas abajo — cinco fotos sin jerarquía.',
  },
  {
    id: 'quintet-air', name: 'Quintet air', photoCount: 5, isNew: true,
    grid: { columns: '0.1fr 0.267fr 0.267fr 0.267fr 0.1fr', rows: '1fr 1fr', areas: '". a b c ." ". . d e ."' },
    slots: ['a', 'b', 'c', 'd', 'e'], slotArs: [0.534, 0.534, 0.534, 0.534, 0.534], hasAir: true,
    tier: 'aire', areaPercent: 67,
    role: 'Primer respiro para 5 fotos — hoy no existe ninguna opción de aire en este conteo.',
    idealMoment: 'Cinco fotos verticales suaves y chicas con aire — la pausa de un día lleno de momentos menores.',
  },

  // ══════════════════════════════ 6 FOTOS (conteo nuevo) ════════════════
  {
    id: 'grid-6', name: 'Grid 6', photoCount: 6, isNew: true,
    // Requiere subir MAX_FACE_PHOTOS (mutations.ts) y MAX_COUNT
    // (pageEngine.ts) de 5 a 6 — cambio de límite en Fase B, no de este archivo.
    grid: { columns: '1fr 1fr 1fr', rows: '1fr 1fr', areas: '"a b c" "d e f"' },
    slots: ['a', 'b', 'c', 'd', 'e', 'f'], slotArs: [0.667, 0.667, 0.667, 0.667, 0.667, 0.667],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Recap clásico 3×2 — el "aquí está todo" en su forma más directa.',
    idealMoment: 'Seis verticales suaves a peso igual — el recap grande, "aquí está todo".',
  },
  {
    id: 'grid-6-wide', name: 'Grid 6 wide', photoCount: 6, isNew: true,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr 1fr', areas: '"a b" "c d" "e f"' },
    slots: ['a', 'b', 'c', 'd', 'e', 'f'], slotArs: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
    tier: 'full-bleed', areaPercent: 100,
    role: 'Recap 2×3 — mismo espíritu, celdas horizontales en vez de verticales.',
    idealMoment: 'Seis horizontales a peso igual — mismo recap, para un día de escenas amplias.',
  },
  {
    id: 'hero-banner-6', name: 'Hero banner 6', photoCount: 6, isNew: true,
    grid: { columns: '1fr 1fr 1fr 1fr 1fr', rows: '2fr 1fr', areas: '"a a a a a" "b c d e f"' },
    slots: ['a', 'b', 'c', 'd', 'e', 'f'], slotArs: [1.5, 0.6, 0.6, 0.6, 0.6, 0.6], heroSlotIndex: 0,
    tier: 'full-bleed', areaPercent: 100,
    role: 'Banner + filmstrip de cinco — la versión a 6 del patrón de hero-banner-5.',
    idealMoment: 'Una horizontal fuerte arriba + un filmstrip de 5 verticales abajo — el recap con protagonista.',
  },
  {
    id: 'sextet-air', name: 'Sextet air', photoCount: 6, isNew: true,
    grid: { columns: '0.175fr 0.217fr 0.217fr 0.217fr 0.175fr', rows: '1fr 1fr', areas: '". a b c ." ". d e f ."' },
    slots: ['a', 'b', 'c', 'd', 'e', 'f'], slotArs: [0.434, 0.434, 0.434, 0.434, 0.434, 0.434], hasAir: true,
    tier: 'aire', areaPercent: 65,
    role: 'La pausa del recap grande — mismo grid-6, con margen lateral para bajar la intensidad.',
    idealMoment: 'Seis verticales angostas con aire — para cerrar un capítulo largo sin saturar la página.',
  },

  // ══════════════════════════════ SPREAD extra ══════════════════════════
  {
    id: 'panorama-air-spread', name: 'Panorama air spread', photoCount: 1, scope: 'spread', isNew: true,
    grid: { columns: '1fr', rows: '0.14fr 0.72fr 0.14fr', areas: '"." "a" "."' },
    slots: ['a'], slotArs: [2.78], hasAir: true,
    tier: 'aire', areaPercent: 72,
    role: 'Panorámica ancha con aire arriba/abajo — el respiro grande del álbum, cruzando el lomo.',
    idealMoment: 'Una panorámica MUY ancha (2.8:1), con aire arriba y abajo — el respiro grande, cruzando el lomo.',
  },
] as const satisfies readonly DraftLayoutSchema[]
