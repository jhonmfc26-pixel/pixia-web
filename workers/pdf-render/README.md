# pixia-pdf-render

Worker de Cloudflare **aparte** del Next.js de `pixia-web` — genera los PDF
de impresión (interior + cubierta extendida) renderizando los MISMOS
componentes React que usa el viewer, vía Cloudflare Browser Rendering
(Puppeteer gestionado). No corre dentro del Worker de Next.js: ni Puppeteer
ni `react-dom/server` pueden importarse ahí (Next rechaza en build/dev
cualquier Route Handler cuyo grafo de imports llegue a `react-dom/server`,
incluso vía `import()` dinámico).

Desplegado y probado en vivo: `https://pixia-pdf-render.jhonmfc26.workers.dev`.

## Por qué es un paquete/servicio aparte

- `@cloudflare/puppeteer` necesita el binding `[browser]`, que es otro tipo
  de Worker (no una Pages Function normal).
- Reusa `core/modules/print/*` (y transitivamente `SpreadFaces.tsx`,
  `DedicationCard.tsx`, `CoverRenderer.tsx`, etc.) importando por ruta
  relativa hacia `../../../core/...` — mismo repo, paquete de despliegue
  distinto. Por eso tiene su propio `package.json`/`wrangler.toml`.
- El bundler es esbuild propio (`build.mjs`), NO el bundler default de
  wrangler — necesario para resolver el alias `@/` que usa todo
  `core/modules/print/`.

## Arquitectura — generación asíncrona por lotes (rediseño post-1102)

La primera versión generaba TODO el interior (todas las páginas + merge) en
una sola invocación síncrona → error 1102 "Worker exceeded memory limit"
(confirmado en vivo con `wrangler tail` contra un álbum real: el isolate de
128MB se llenaba de acumular los N PDFs de página antes del merge).

Diseño actual:

1. `POST /render-interior` (sin `offset`) arranca el job: crea la fila en
   `pdf_generation_jobs` (Supabase) y responde `202` al toque — no espera
   nada.
2. El trabajo real corre dentro de `ctx.waitUntil()`: procesa un lote de
   `CHUNK_SIZE` (4) páginas reusando UNA sola página de browser
   (`createCloudflarePageRenderer`), sube cada PDF de página a Supabase
   Storage (bucket privado `pdfs`) apenas se renderiza y lo descarta — nunca
   acumula los N buffers en memoria.
3. Si quedan más páginas, dispara el siguiente lote con un `fetch` HTTP real
   a sí mismo (`/render-interior` con el próximo `offset`) — cada lote es una
   invocación de Worker **nueva e independiente**, con su propio presupuesto
   de CPU/memoria. No es una recursión in-process.
4. En el último lote arma el PDF final descargando las páginas de Storage de
   a una por vez (nunca las N juntas) y lo sube como `.../interior/final.pdf`.
5. `POST /render-cover` es más simple (1 sola página física) pero sigue el
   mismo patrón: 202 inmediato, trabajo en `waitUntil`, resultado a Storage.
6. Estado consultable en `pdf_generation_jobs`: `generando_pdf` → `pdf_listo`
   / `error_generacion`. La ruta dev de pixia-web expone esto en
   `?which=status` y `?which=download` (URLs firmadas, 5 min).
7. Cron Trigger (`*/5 * * * *`, ver `scheduled()` en `src/index.ts`) marca
   `error_generacion` los jobs sin progreso hace >3 min. El reintento es
   manual: volver a pegarle a `/render-interior` con el mismo `albumId`
   reinicia limpio (upsert + overwrite en Storage, es idempotente).

Se evaluaron y descartaron Cloudflare Queues (cada consumer seguiría atado a
los mismos límites por invocación — no saca la necesidad del chunking, solo
suma infraestructura) y Durable Objects (no hay estado concurrente real que
coordinar; Supabase ya es la fuente de verdad del progreso). El
self-continuation por HTTP + Cron watchdog no suma ningún producto de
Cloudflare nuevo — cero costo extra.

## Deploy

1. Cuenta de Cloudflare con **Workers Paid** habilitado (Browser Rendering
   no está en el plan free). Ya habilitado en esta cuenta.
2. `cd workers/pdf-render && npm install`
3. `wrangler login` (si no está logueado ya)
4. Secretos (nunca se comparten los valores, solo los nombres):
   ```
   wrangler secret put PDF_RENDER_SECRET        # mismo valor que PDF_RENDER_SECRET en pixia-web
   wrangler secret put SUPABASE_URL              # mismo valor que NEXT_PUBLIC_SUPABASE_URL en pixia-web
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY # mismo valor que SUPABASE_SERVICE_ROLE_KEY en pixia-web
   ```
5. Correr **una vez** `supabase/pdf_jobs.sql` (SQL editor de Supabase) —
   crea `pdf_generation_jobs` y el bucket privado `pdfs`.
6. `npm run deploy` (corre `build.mjs` y después `wrangler deploy`)
7. Confirmar `GET https://<worker-url>/health` responde `ok`.
8. En pixia-web, `.env.local` necesita `PDF_RENDER_WORKER_URL` (la URL del
   paso 6) y `PDF_RENDER_SECRET` (mismo valor del paso 4).

## Endpoints

- `GET /health` → `200 ok`, sin auth.
- `POST /render` → body `{ html, widthMm, heightMm }` → PDF de una página,
  síncrono. Primitiva de bajo nivel, no pasa por el flujo de lotes/jobs.
- `POST /render-interior` → body `{ albumId, structure, photos, format, baseUrl }`
  → `202`, arranca el job asíncrono por lotes.
- `POST /render-cover` → body `{ albumId, cover, coverPhotoUrl?, structure, format, baseUrl }`
  → `202`, arranca la generación de cubierta.

Todos (salvo `/health`) requieren `Authorization: Bearer <PDF_RENDER_SECRET>`.

## Qué falta para producción real (bricks futuros)

- Enganchar el trigger real: `app/api/orders/webhook/route.ts` ya setea
  `print_status = 'paid'` al aprobar el pago — falta que ese mismo webhook
  dispare `POST /render-interior` + `/render-cover` (hoy solo lo dispara la
  ruta dev, a propósito, para no tocar el webhook de pagos en este ticket).
- Migrar el bucket `pdfs` (Supabase Storage, temporal) a R2 privado — mismo
  mecanismo S3-compatible que ya usa `app/api/upload/route.ts` para las
  fotos, solo que con un bucket separado (privado, no el de fotos públicas).
- El merge final today descarga las N páginas de Storage en un solo lote —
  para álbumes bien grandes (60+ páginas) se puede acotar también, ver
  comentario en `processInteriorChunk`.
