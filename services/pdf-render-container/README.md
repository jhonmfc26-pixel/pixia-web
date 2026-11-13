# pixia-pdf-render-container

Genera el PDF de impresión (interior + cubierta) en **una sola pasada** con
Playwright/Chromium real, corriendo en un contenedor (Google Cloud Run) —
reemplazo del Worker de Cloudflare (`workers/pdf-render/`, 128MB de RAM,
necesitaba página-por-página + merge + sub-lotes por el límite de memoria).
Acá hay RAM real (2GB+), así que el álbum completo se arma como UN documento
HTML (todas las páginas con salto de página CSS) y Chromium lo pagina de un
tirón — sin merge, sin OOM.

**El Worker CF sigue activo y funcionando** — este contenedor es una
migración que se valida en paralelo (ver `?engine=worker|container` en
`app/api/dev/generate-pdf/route.ts`), no un reemplazo inmediato.

## Cómo se comparte el código con la app (WYSIWYG)

Mismo patrón que `workers/pdf-render/`: el build (`build.mjs`, esbuild) entra
a `core/modules/print/*` por ruta relativa, resolviendo el alias `@/` del
`tsconfig.json` raíz de pixia-web. Esos módulos importan transitivamente los
MISMOS componentes que usa el viewer real (`SpreadFaces.tsx`,
`DedicationCard.tsx`, `CoverRenderer.tsx`, con el fix de `manualCover.ts`) —
WYSIWYG por construcción, no por mantener dos copias sincronizadas.

Lo nuevo de este brick (no lo tenía el Worker CF, que SIEMPRE generaba
página por página):
- `core/modules/print/generateAlbumPdfs.tsx` → `buildInteriorPageElements`
  (export nuevo, no toca `buildInteriorPages` que sigue usando el Worker CF)
  — devuelve los ELEMENTOS de React de cada página sin envolverlos en un
  documento HTML aparte cada uno.
- `core/modules/print/renderPrintAlbumHtml.ts` (archivo nuevo) →
  `wrapPrintAlbumHtml` — arma UN documento con todas las páginas (separadas
  por `break-after: page`), un solo `@page`, fuentes cargadas una sola vez.

A diferencia de un Worker de Cloudflare, este es Node.js normal — nada de
`nodejs_compat`, ni restricciones de bundle, ni el problema de
`react-dom/server` que sí afectaba a los Route Handlers de Next. Por eso
`react-dom/server`'s `renderToStaticMarkup` se usa acá sin ningún workaround.

## R2 desde fuera de Cloudflare

El Worker CF accedía a R2 con el **binding nativo** (sin credenciales). Un
contenedor en GCP no tiene acceso a bindings de Cloudflare — necesita la
**API S3-compatible de R2** con Access Key/Secret reales (`@aws-sdk/client-s3`,
mismo mecanismo que ya usa `app/api/upload/route.ts` para el bucket público
de fotos, pero acá con credenciales propias escopeadas solo al bucket
privado `pixia-pdfs-private`).

**Signed URLs**: NO son presigned URLs de S3 — son un token HMAC-SHA256
propio sobre `key|exp` (ver `src/r2.ts`), firmado con el mismo
`PDF_CONTAINER_SECRET` que ya usa la app para autenticar `/render-*`. La app
firma la URL localmente (sin ida y vuelta) y el contenedor la valida en
`GET /download`, streameando el objeto desde R2. Mismo esquema que
`workers/pdf-render/src/r2Storage.ts`, solo que ahí corría en el Worker CF.

## Endpoints

- `GET /health` → `200 ok`, sin auth.
- `POST /render-interior` → body `{ albumId, structure, photos, format, baseUrl }`,
  `Authorization: Bearer <PDF_CONTAINER_SECRET>` → **SÍNCRONO**: renderiza el
  álbum completo, sube a R2, actualiza `pdf_generation_jobs`, responde
  `{ albumId, key, bytes, warningsCount, elapsedMs }` cuando termina. Puede
  tardar decenas de segundos con álbumes grandes — normal, Cloud Run soporta
  requests largos (a diferencia del Worker CF, sin el límite de ~30s de
  `ctx.waitUntil` que forzó todo el rediseño por lotes anterior).
- `POST /render-cover` → igual, para la cubierta.
- `GET /download?key=&exp=&sig=` → streamea el PDF si el token es válido.
- `GET /sign?key=` (con Bearer) → diagnóstico, firma una URL suelta.
- `POST /storage-cleanup?mode=prueba|aplicada` (con Bearer) → mide y limpia
  el almacenamiento (ver «Limpieza de almacenamiento»).

## Build y prueba local (con Docker)

```bash
# Desde la RAÍZ del repo (pixia-web/) — el build context tiene que
# alcanzar core/, no solo esta carpeta.
docker build -f services/pdf-render-container/Dockerfile -t pixia-pdf-render-container .

docker run --rm -p 8080:8080 \
  -e PDF_CONTAINER_SECRET=dev-secret \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e R2_PDF_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
  -e R2_PDF_BUCKET=pixia-pdfs-private \
  -e R2_PDF_ACCESS_KEY_ID=... \
  -e R2_PDF_SECRET_ACCESS_KEY=... \
  pixia-pdf-render-container

curl http://localhost:8080/health
```

## Redesplegar después de cambios en el código (lo más común)

Cualquier cambio en `services/pdf-render-container/` o en el `core/` que
importa (layouts, portada, impresión) solo llega a Cloud Run con un build y
un deploy nuevos. El proyecto real es `project-d750839b-5664-4e5c-87b`
(«pixia-print» es solo el nombre visible; los comandos de más abajo usan ese
nombre como ejemplo y fallan con «Permission denied»).

```bash
# 1. Siempre desde main actualizado: el build sube TU copia local del repo.
git checkout main && git pull

# 2. Build con un tag nuevo (subir el número cada vez: v9, v10, …)
gcloud config set project project-d750839b-5664-4e5c-87b
gcloud builds submit --config services/pdf-render-container/cloudbuild.yaml \
  --substitutions _IMAGE_TAG=gcr.io/project-d750839b-5664-4e5c-87b/pdf-render-container:v9 .

# 3. Deploy: solo cambia la imagen; secretos, variables y memoria se mantienen.
gcloud run deploy pixia-pdf-render --region us-central1 \
  --image gcr.io/project-d750839b-5664-4e5c-87b/pdf-render-container:v9
```

Historial: v8 = trigger de PDF pagado (2026-11-03) · v9 = formato vertical,
portada que cubre el sangrado y título sin palabras partidas (2026-11-09) ·
v10 = logo grande en la contraportada y limpieza de almacenamiento
(2026-11-09, ver «Limpieza de almacenamiento»).

## Deploy a Google Cloud Run — paso a paso

Asume que es la primera vez que se usa GCP para este proyecto.

### 1. Cuenta y proyecto GCP

1. Entrar a https://console.cloud.google.com/ con una cuenta de Google (crear
   una si hace falta). GCP da crédito gratis para cuentas nuevas.
2. Crear un proyecto nuevo (ej. `pixia-print`) desde el selector de proyecto
   arriba a la izquierda → "New Project".
3. Habilitar facturación (Billing) — Cloud Run tiene capa gratis generosa,
   pero el proyecto necesita una cuenta de facturación vinculada igual.

### 2. Instalar gcloud CLI (en tu máquina, no acá)

```bash
# macOS
brew install --cask google-cloud-sdk
# Linux/otros: https://cloud.google.com/sdk/docs/install

gcloud init                       # loguea y elige el proyecto (pixia-print)
gcloud auth login
gcloud config set project pixia-print
```

### 3. Habilitar las APIs necesarias

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

### 4. Crear las credenciales R2 para el bucket privado

En el dashboard de Cloudflare → R2 → `pixia-pdfs-private` → "Manage R2 API
Tokens" → crear un token **escopeado SOLO a este bucket** (no el de fotos
públicas), con permisos de Object Read & Write. Copiar:
- Access Key ID
- Secret Access Key
- El endpoint S3-compatible de la cuenta (`https://<account-id>.r2.cloudflarestorage.com`,
  el account-id está en el dashboard de Cloudflare)

**Nunca commitear estos valores** — van directo a Secret Manager (paso 6).

### 5. Build y push de la imagen (Cloud Build, sin Docker local)

```bash
cd pixia-web   # raíz del repo
gcloud builds submit --config services/pdf-render-container/cloudbuild.yaml \
  --substitutions=_IMAGE_TAG=gcr.io/pixia-print/pdf-render-container .
```

(O con Docker local + push manual si preferís: `docker build -f
services/pdf-render-container/Dockerfile -t
gcr.io/pixia-print/pdf-render-container . && docker push
gcr.io/pixia-print/pdf-render-container` — necesita `gcloud auth
configure-docker` una vez.)

### 6. Secretos en Secret Manager

```bash
echo -n "TU_VALOR" | gcloud secrets create PDF_CONTAINER_SECRET --data-file=-
echo -n "TU_VALOR" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo -n "TU_VALOR" | gcloud secrets create R2_PDF_ACCESS_KEY_ID --data-file=-
echo -n "TU_VALOR" | gcloud secrets create R2_PDF_SECRET_ACCESS_KEY --data-file=-
```

(`SUPABASE_URL`, `R2_PDF_ENDPOINT`, `R2_PDF_BUCKET` no son secretos de
verdad — pueden ir como variables de entorno normales en el deploy, no hace
falta Secret Manager para esos tres.)

### 7. Deploy a Cloud Run

```bash
gcloud run deploy pixia-pdf-render \
  --image gcr.io/pixia-print/pdf-render-container \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 3 \
  --no-allow-unauthenticated \
  --set-env-vars SUPABASE_URL=https://xxx.supabase.co,R2_PDF_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com,R2_PDF_BUCKET=pixia-pdfs-private \
  --set-secrets PDF_CONTAINER_SECRET=PDF_CONTAINER_SECRET:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,R2_PDF_ACCESS_KEY_ID=R2_PDF_ACCESS_KEY_ID:latest,R2_PDF_SECRET_ACCESS_KEY=R2_PDF_SECRET_ACCESS_KEY:latest
```

Notas sobre las flags:
- `--memory 2Gi --cpu 2`: pedido explícito del ticket — sobra para 36-40
  páginas (el interior completo mide ~114MB en el caso probado, bien lejos
  de 2GB).
- `--timeout 300`: 5 min — un álbum grande puede tardar más que una request
  HTTP típica; Cloud Run soporta hasta 60 min si hiciera falta más.
- `--no-allow-unauthenticated`: el servicio NO queda público — solo se
  invoca con el `Authorization: Bearer` que ya valida `checkAuth` en
  `server.ts`. (Cloud Run igual exige que la URL sea alcanzable — esta flag
  controla el IAM de invocación, no reemplaza el Bearer propio; para un
  primer test simple alcanza con dejarlo así y confiar en el Bearer.)
- `--min-instances 0`: escala a cero cuando no hay generaciones — sin costo
  en reposo, con el trade-off de un cold start (unos segundos extra) en la
  primera request después de estar inactivo.

Al terminar, `gcloud run deploy` imprime la URL del servicio
(`https://pixia-pdf-render-xxxxx-uc.a.run.app`) — esa es `PDF_CONTAINER_URL`
en `.env.local` de pixia-web.

### 8. Variables en pixia-web

En `.env.local` (nunca en el repo):
```
PDF_CONTAINER_URL=https://pixia-pdf-render-xxxxx-uc.a.run.app
PDF_CONTAINER_SECRET=<mismo valor que el secreto de Cloud Run>
```

### 9. Confirmar que quedó vivo

```bash
curl https://pixia-pdf-render-xxxxx-uc.a.run.app/health
# → ok
```

## Cola de producción pagado → PDF

El webhook de Wompi NO llama a este contenedor: al aprobar una orden solo
deja el job en `pendiente` en `pdf_generation_jobs` (`lib/pdfQueue.ts`).
Cloud Scheduler llama cada 5 min a `POST /process-pending`, que hace el
barrido en `src/queue.ts`:

1. **Reconciliar:** órdenes aprobadas (últimos 30 días) sin job → se encolan.
   Red de seguridad por si el webhook no pudo encolar.
2. **Expirar:** jobs que agotaron los 3 intentos → `fallo`.
3. **Procesar:** reclama jobs de a uno (`claim_next_pdf_job`, atómico con
   `FOR UPDATE SKIP LOCKED`) y genera interior + cubierta. Hasta 5 jobs o
   3 min por barrido.
4. **Alertar:** todo `fallo` sin `alerted_at` → email por Resend a
   `ALERT_EMAIL`. Si Resend falla, se reintenta en el próximo barrido.

Estados: `pendiente` → `generando_pdf` → `pdf_listo`, o
`error_generacion` (se reintenta) → `fallo` (agotó intentos, requiere
intervención). `attempt_count` cuenta reclamos, así que un álbum que tumba el
contenedor también consume intentos. Un job `generando_pdf` con
`claimed_at` de más de 15 min se considera colgado y se reintenta.

La cola solo toma jobs con `order_reference` — las pruebas de la ruta dev
(sin orden) nunca se procesan solas.

### Un PDF incompleto no sale

Antes de entregar un PDF se comprueba que se puede imprimir tal cual:

- **Fotos sin subir** (`core/modules/print/printablePhotos.ts`): si una foto
  colocada en el álbum no está en el almacenamiento (quedó como copia dentro
  del álbum o vacía), el job pasa directo a `fallo` y llega la alerta. No se
  arregla reintentando: el cliente tiene que volver a subirla.
- **Fotos o fuentes que no cargan** (`src/renderAlbum.ts`): si al armar el
  PDF alguna imagen, fuente u hoja de estilos falla, no se genera. El error
  dice cuál fue; la cola reintenta (suele ser algo pasajero de red) y, si
  sigue fallando, alerta.
- **Dominios permitidos** (`src/printHosts.ts`): Chromium solo descarga de
  `assets.pixiaa.com`, del dominio de `PRINT_BASE_URL` y de Google Fonts. Si el
  almacenamiento cambia de dirección, se agrega sin tocar código:

  ```bash
  gcloud run services update pixia-pdf-render --region us-central1 \
    --update-env-vars PRINT_EXTRA_HOSTS="fotos.ejemplo.com"
  ```

Tests de la lógica (sin Chromium ni Supabase), desde la raíz:
```bash
npx tsx --test services/pdf-render-container/test/queue.test.ts
```

### Puesta en marcha (una sola vez)

```bash
# 1. Supabase → SQL editor: pegar y correr supabase/pdf_jobs_trigger.sql
#    (idempotente).

# 2. Secretos nuevos
echo -n "re_..." | gcloud secrets create RESEND_API_KEY --data-file=-

# 3. Build + deploy de la imagen nueva (desde la RAÍZ del repo)
gcloud builds submit --config services/pdf-render-container/cloudbuild.yaml \
  --substitutions _IMAGE_TAG=gcr.io/project-d750839b-5664-4e5c-87b/pdf-render-container:v8 .
gcloud run deploy pixia-pdf-render --region us-central1 \
  --image gcr.io/project-d750839b-5664-4e5c-87b/pdf-render-container:v8 \
  --update-env-vars ALERT_EMAIL=<tu correo>,EMAIL_FROM="Pixia <alertas@pixiaa.com>" \
  --update-secrets RESEND_API_KEY=RESEND_API_KEY:latest
# (EMAIL_FROM tiene que ser un dominio verificado en Resend — el mismo que
#  usa la app para la confirmación de pedido.)

# 4. Cloud Scheduler: barrido cada 5 min
gcloud services enable cloudscheduler.googleapis.com
gcloud scheduler jobs create http pixia-pdf-sweep \
  --location us-central1 \
  --schedule "*/5 * * * *" \
  --http-method POST \
  --uri https://pixia-pdf-render-316585315237.us-central1.run.app/process-pending \
  --headers "Authorization=Bearer $(gcloud secrets versions access latest --secret=PDF_CONTAINER_SECRET)" \
  --attempt-deadline 300s

# 5. Probar el barrido a mano (no espera al Scheduler)
gcloud scheduler jobs run pixia-pdf-sweep --location us-central1
# o con curl + el Bearer → responde JSON con reconciled/expired/processed/alerts
```

Para reintentar a mano un job en `fallo` después de corregir la causa:
```sql
UPDATE pdf_generation_jobs SET status = 'pendiente', attempt_count = 0, alerted_at = NULL
 WHERE blueprint_id = '<id del álbum>';
```

## Limpieza de almacenamiento (desde v10)

`POST /storage-cleanup?mode=prueba|aplicada` (con Bearer) mide los dos buckets
de R2, aplica la política de `lib/retention.ts` y guarda un reporte en
`storage_reports`, que se ve en **/admin/almacenamiento**:

- Álbum sin comprar: se guarda 30 días desde que se creó; luego se borran su
  fila y sus fotos.
- Álbum comprado: fotos y PDF hasta 30 días después de la entrega; luego se
  borran los archivos y se marca `orders.assets_purged_at`. El pedido queda.
- Nada de menos de 30 días se borra; solo se tocan claves `users/` del bucket
  de fotos; máximo 20.000 archivos por corrida (los más viejos primero).
- `prueba` (por defecto) solo mide y dice qué se borraría. `aplicada` borra.
- Alerta por correo (`ALERT_EMAIL`) cuando el uso pasa del 80 % del
  presupuesto, cuando un borrado falla y cuando la corrida falla.

### Puesta en marcha (una sola vez)

```bash
# 1. Supabase → SQL editor: correr supabase/almacenamiento.sql (idempotente).

# 2. Credenciales R2 del bucket de FOTOS (el mismo que usa la app en R2_BUCKET).
#    Cloudflare → R2 → Manage API tokens → token "Object Read & Write"
#    limitado a ese bucket. Se pueden reusar las de la app.
echo -n "ACCESS_KEY_ID" | gcloud secrets create R2_ASSETS_ACCESS_KEY_ID --data-file=-
echo -n "SECRET"        | gcloud secrets create R2_ASSETS_SECRET_ACCESS_KEY --data-file=-
#    (si el token es nuevo o distinto: darle acceso a la cuenta de servicio
#     de Cloud Run igual que con los secretos del paso 6)

# 3. Build + deploy v10 (desde main actualizado, en la RAÍZ del repo)
git checkout main && git pull
gcloud config set project project-d750839b-5664-4e5c-87b
gcloud builds submit --config services/pdf-render-container/cloudbuild.yaml \
  --substitutions _IMAGE_TAG=gcr.io/project-d750839b-5664-4e5c-87b/pdf-render-container:v10 .
gcloud run deploy pixia-pdf-render --region us-central1 \
  --image gcr.io/project-d750839b-5664-4e5c-87b/pdf-render-container:v10 \
  --update-env-vars R2_ASSETS_BUCKET=<nombre del bucket de fotos>,STORAGE_BUDGET_GB=10,STORAGE_ALERT_PCT=80,STORAGE_CLEANUP_MODE=prueba \
  --update-secrets R2_ASSETS_ACCESS_KEY_ID=R2_ASSETS_ACCESS_KEY_ID:latest,R2_ASSETS_SECRET_ACCESS_KEY=R2_ASSETS_SECRET_ACCESS_KEY:latest

# 4. Cloud Scheduler: todos los días a las 3 a. m. hora Colombia
gcloud scheduler jobs create http pixia-storage-cleanup \
  --location us-central1 \
  --schedule "0 3 * * *" --time-zone America/Bogota \
  --http-method POST \
  --uri https://pixia-pdf-render-316585315237.us-central1.run.app/storage-cleanup \
  --headers "Authorization=Bearer $(gcloud secrets versions access latest --secret=PDF_CONTAINER_SECRET)" \
  --attempt-deadline 300s

# 5. Primera medición a mano (modo prueba: no borra nada)
gcloud scheduler jobs run pixia-storage-cleanup --location us-central1
```

Revisar el reporte en /admin/almacenamiento («Por borrar»). Si lo que se
borraría está bien, activar el borrado real:

```bash
gcloud run services update pixia-pdf-render --region us-central1 \
  --update-env-vars STORAGE_CLEANUP_MODE=aplicada
```

Para volver a solo medir: lo mismo con `STORAGE_CLEANUP_MODE=prueba`.
`STORAGE_BUDGET_GB` es el tamaño contra el que se calcula el % y la alerta
(10 GB = lo gratis de R2; subirlo cuando se decida pagar más).

## Qué NO se pudo validar en esta sesión

Sin `gcloud` CLI ni credenciales GCP en este entorno, no se pudo:
- Correr el deploy real a Cloud Run.
- Confirmar tiempos/RAM pico contra el servicio desplegado de verdad.

Sí se validó localmente (Docker está disponible acá):
- `npx tsc --noEmit` limpio.
- El bundle esbuild (`node build.mjs`) — 47.9kb, sin errores de resolución
  de `@/core/...`.
- `docker build` de la imagen completa (Dockerfile + Playwright + Chromium)
  — ver estado exacto en el reporte de cierre de este ticket.
