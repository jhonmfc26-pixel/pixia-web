# Pixia — Contexto del proyecto

## Estado actual (2026-05-28)

- **Sprints completados:** 1–6 + portada + Sprint 7 (zoom/pan) + Sprint A parte 1
- **Última arquitectura:** viewer (read-only) y editor separados en `/book/[id]` y `/book/[id]/edit`
- **Pendiente inmediato:** Sprint A parte 2 — limpiar PixiaViewer de lógica de edición (dejarlo read-only puro)
- **Próximos:** Sprint B (face detection), Sprint C (algoritmo de layouts v2), Sprint D (PDF generación)

## Stack

- Next.js 16.1.4 + TypeScript (strict), Turbopack en dev
- Cloudflare Pages — deploy automático desde GitHub, **runtime edge obligatorio en todas las rutas API**
- Cloudflare R2: bucket `pixia-assets`, acceso por AWS Sig V4 manual (no SDK, incompatible con edge)
- Claude API (Haiku): solo post-pago
- Wompi: pagos Colombia (pendiente integración)
- No Supabase activo — todo en localStorage por ahora

## Reglas absolutas

1. **No fotos repetidas** — un `photo.id` NUNCA aparece dos veces en el álbum
2. **Cero espacios negros** — zoom mínimo = 1 (cover exacto), nunca < 1
3. **IA decide, usuario aprueba** — el algoritmo propone layouts y orden; el usuario solo ajusta
4. **WYSIWYG real** — lo que se ve en el editor = lo que va al álbum (CSS nativo, misma fórmula)
5. **Editor opcional e invisible** — el viewer funciona perfecto sin editar nada

## Filosofía Pixia

> "No tuve que diseñar nada"

La IA analiza EXIF, score, orientación y acto narrativo. Construye el álbum completo.
El usuario solo encuadra fotos (drag/zoom) y cambia layouts si quiere.

## Decisiones técnicas clave

| Decisión | Por qué |
|----------|---------|
| CSS nativo (`object-fit: cover` + `object-position`) | Elimina medición del DOM, cero timing issues, garantiza cobertura |
| Viewer y Editor en rutas separadas | Resuelve conflictos de eventos con react-pageflip |
| `pointer-events: none` en wrapper del flipbook en modo edit | CSS siempre funciona, props de react-pageflip son inconsistentes |
| `localStorage` entries para `layoutConfig` y `placements` | Maps no son JSON-serializables directamente; se guardan como `Array.from(map.entries())` |
| R2 guarda fotos originales sin comprimir | El fallback a base64 comprimido solo ocurre si falla el upload |
| AWS Sig V4 manual con Web Crypto | AWS SDK no corre en Cloudflare edge runtime |

## Archivos críticos

```
core/contracts/AlbumBlueprint.ts     — contrato central (PhotoAsset, Spread, CoverConfig, etc.)
core/modules/album/types.ts          — PageLayout, PhotoPlacement, LayoutConfig, Page
core/modules/album/pageEngine.ts     — buildPages(), extractPhotoPool(), autoLayout(), isCompatibleLayout()

core/modules/viewer/PixiaViewer.tsx  — viewer read-only con react-pageflip (limpiar en Sprint A parte 2)
core/modules/viewer/PageRenderer.tsx — renderiza una página con CSS nativo; PhotoFrame con drag/zoom inline

core/modules/editor/EditorView.tsx   — vista de spreads planos (sin flipbook), spreads de a 2
core/modules/editor/EditorPhotoFrame.tsx — frame con drag/zoom, sin conflictos de react-pageflip
core/modules/editor/EditorPanel.tsx  — panel lateral de selección de layout
core/modules/editor/EditorPhotoFrame.tsx — frame editable para el editor separado

core/modules/cover/CoverEditor.tsx   — modal de edición de portada (plantillas, foto, texto, posición)
core/modules/cover/CoverRenderer.tsx — renderiza la portada (compartido por viewer y editor)
core/modules/cover/coverTemplates.ts — 11 plantillas por ocasión

app/api/upload/route.ts              — upload a R2, edge runtime, AWS Sig V4 manual
app/book/[id]/page.tsx               — viewer (read-only)
app/book/[id]/edit/page.tsx          — editor (hidrata layoutConfig/placements desde localStorage)
```

## Modelo de datos en localStorage

```
pixia_books[bookId] = {
  ...AlbumBlueprint,
  layoutConfig: Array<[number, PageLayout]>,   // Map<pageIndex, layout> serializado
  placements:   Array<[string, PhotoPlacement]>, // Map<photoId, placement> serializado
}
```

## PhotoPlacement

```typescript
{ zoom: number, offsetX: number, offsetY: number }
// zoom: 1.0 (cover) a 3.0 (máximo zoom in)
// offsetX/Y: -50 a +50 (% de desplazamiento)
// zoom < 1 no permitido → espacios negros
```

## Render de fotos (CSS nativo)

```css
img {
  object-fit: cover;
  object-position: ${50 + offsetX}% ${50 + offsetY}%;
  transform: scale(${zoom});
}
```

La misma fórmula en `PageRenderer.tsx` (viewer) y `EditorPhotoFrame.tsx` (editor) garantiza WYSIWYG.

## Layouts disponibles

| Layout | Fotos | Descripción |
|--------|-------|-------------|
| `single` | 1 | Página completa |
| `portrait` | 1 | Vertical con aire (15% padding) |
| `stack-2` | 2 | Apiladas vertical |
| `side-2` | 2 | Lado a lado |
| `grid-3` | 3 | 1 grande + 2 pequeñas |
| `grid-4` | 4 | Grid 2×2 |
| `hero-spread` | 1 | Foto heroica a doble página (`scope: 'spread'`) |

### Compatibilidad automática

- **landscape** → `single`, `stack-2`, `grid-3`, `grid-4`
- **portrait** → `portrait`, `side-2`, `grid-4`
- **square** → cualquiera

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/create` | Wizard de creación (upload + IA) |
| `/book/[id]` | Viewer read-only con react-pageflip |
| `/book/[id]/edit` | Editor plano por spreads (sin flipbook) |

## Deuda técnica conocida
- `core/modules/album/pageEngine.ts` es el sistema canónico TEMPORAL.
  Hay 2 vocabularios de layouts incompatibles (engine vs IA/contrato).
  Pendiente unificar al vocabulario del contrato en un sprint futuro.
- El viewer es read-only puro. Toda la lógica de páginas vive en el caller.
- Tracking de funnel en Supabase desactivado (era no-op en práctica).
  `useSession.trackEvent` y `useSession.updateFunnelStage` quedaron como
  no-ops. Reactivar cuando se conecte el backend.
  
  - Duplicación de rendering entre editor (EditorSpreadPage en EditorView.tsx)
  y viewer (LayoutRenderer.tsx). El editor mantiene lógica propia para
  soportar pan/zoom interactivo en cada foto. Refactor pendiente: hacer
  que LayoutRenderer acepte un componente de PhotoFrame inyectable (normal
  vs editable) para eliminar la duplicación.
