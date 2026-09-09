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
