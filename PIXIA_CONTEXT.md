# Pixia — Contexto del proyecto

## Stack
- Next.js 16 + TypeScript + Tailwind
- Cloudflare Pages (deploy automático desde GitHub)
- Supabase (DB): obeaurqssfmiibndkzos.supabase.co
- Cloudflare R2: bucket pixia-assets
- Claude API: Haiku post-pago únicamente
- Wompi: pagos Colombia (pendiente integración)

## Arquitectura
Módulos independientes en core/modules/
Contrato central: core/contracts/AlbumBlueprint.ts
Viewer: core/modules/viewer/PixiaViewer.tsx
7 layouts: full, double, duo-v, duo-h, trio, hero-2, portrait

## Sprint actual: Sprint 2 (viewer)
### Pendiente en este sprint:
- FIX: páginas derechas vacías cuando layout es full
- FIX: DuoHLayout fotos apiladas verticalmente  
- FIX: combinar spreads full consecutivos en duo-v
- Sprint 3: módulo editor (reemplazar foto, cambiar layout)
- Sprint 4: lectura EXIF + scoring de fotos en browser
- Sprint 5: upload a R2 + preview con marca de agua
- Sprint 6: pagos Wompi
- Sprint 7: IA post-pago + PDF
- Sprint 8: portal imprentas
- Sprint 9: dashboard

## Reglas absolutas del sistema
1. Un photo.id NUNCA se repite en el álbum
2. La IA (Claude) solo corre DESPUÉS del pago
3. Preview sin IA = gratis = sin tokens gastados
4. Cada módulo es independiente
