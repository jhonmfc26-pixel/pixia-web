# Build context = RAÍZ del repo (pixia-web/), no esta carpeta — hace falta
# acceso a core/ para resolver los imports @/core/... (ver build.mjs). Build:
#   docker build -f services/pdf-render-container/Dockerfile -t pixia-pdf-render .
#
# La versión de la imagen DEBE calzar EXACTO con la versión de "playwright"
# en package.json (1.62.1) — Playwright verifica que el binario de Chromium
# de la imagen coincida con la versión del paquete npm, si no falla al
# lanzar el browser. Si se sube la versión del paquete, subir el tag acá
# también.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

# Solo lo que hace falta para resolver los imports del bundle — core/ entero
# (generateAlbumPdfs.tsx importa transitivamente SpreadFaces.tsx,
# DedicationCard.tsx, CoverRenderer.tsx, etc., mismos componentes que el
# viewer y el Worker CF), MÁS components/ y lib/ completos: SpreadFaces.tsx y
# DedicationCard.tsx importan @/components/ui/PixiaImage (fallback de fotos
# rotas) y @/lib/devLog — únicas dependencias de core/ fuera de core/ mismo
# (confirmado con grep de todos los imports "@/" en core/). Se copian las
# carpetas completas, no solo esos dos archivos, para no volver a este mismo
# ciclo de build fallido si mañana se agrega otro import a @/components/* o
# @/lib/* — son livianas (~180K juntas) y esbuild solo bundlea lo que de
# verdad se importa, así que copiar de más acá no infla el bundle final.
COPY core ./core
COPY components ./components
COPY lib ./lib
COPY services/pdf-render-container ./services/pdf-render-container

WORKDIR /app/services/pdf-render-container
RUN npm ci
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# La imagen mcr.microsoft.com/playwright ya trae Chromium instalado y todas
# sus dependencias del sistema — no hace falta `npx playwright install`.
CMD ["node", "dist/server.js"]
