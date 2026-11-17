This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Despliegue (Cloudflare Workers + OpenNext)

Desde noviembre de 2026 la web corre como un **Worker de Cloudflare** llamado `pixia`, armado con [OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`). Reemplaza al proyecto de Cloudflare Pages + `next-on-pages`, que llegó al límite de 25 MiB de Pages. El Worker pesa unos 2 MB comprimido de 10 MB permitidos en el plan pagado.

- **Configuración:** `wrangler.jsonc` (nombre, KV del limitador, sin direcciones `*.workers.dev`) y `open-next.config.ts`.
- **Despliegue automático:** Workers Builds, conectado al repo. Cada merge a `main` compila y despliega.
  - Comando de compilación: `pnpm exec opennextjs-cloudflare build`
  - Comando de despliegue: `pnpm exec opennextjs-cloudflare deploy`
- **Probar el Worker en local:** `pnpm preview`. Necesita un archivo `.dev.vars` con las variables del servidor; no se sube al repo.
- **Las rutas NO llevan `export const runtime = 'edge'`** (OpenNext no lo admite). Para KV y `waitUntil` se usa `getCloudflareContext()` de `@opennextjs/cloudflare`.

### Variables

Van en Cloudflare → Workers → `pixia` → Settings:

| Dónde | Variables |
|---|---|
| **Build → Variables** (se fijan al compilar) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`, `NEXT_PUBLIC_R2_PUBLIC_URL`, `NEXT_PUBLIC_SITE_URL` (y `NEXT_PUBLIC_RITMO_LAYOUTS` si se usa) |
| **Variables and Secrets** (en cada petición; las llaves como *Secret*) | `SUPABASE_SERVICE_ROLE_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_API_URL` (opcional), `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SUPPORT`, `ALERT_EMAIL`, `PQR_NOTIFY_EMAILS`, `ADMIN_EMAILS`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `PDF_CONTAINER_URL`, `PDF_CONTAINER_SECRET` |

Las `NEXT_PUBLIC_*` se copian dentro del código al compilar. Si cambian, hay que volver a desplegar; ponerlas solo en «Variables and Secrets» no alcanza.

`/admin/lanzamiento` muestra si falta alguna.

### Volver atrás

Mientras exista el proyecto de Pages: quitar `pixiaa.com` de los dominios del Worker y volver a agregarlo en Pages → Custom domains. Pages sirve su último despliegue bueno.
