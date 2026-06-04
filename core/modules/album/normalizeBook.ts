import type { AlbumBlueprint } from '@/core/contracts/AlbumBlueprint'
import { getDefaultTemplate } from '@/core/modules/cover/coverTemplates'

// Vocabulario de layouts: IA viejo → contrato actual
export function mapOldLayout(layout: string | undefined): AlbumBlueprint['spreads'][number]['layout'] {
  switch (layout) {
    case 'full-bleed': return 'full'
    case 'split-horizontal': return 'duo-v'
    case 'editorial-right': return 'hero-2'
    default: return (layout || 'full') as AlbumBlueprint['spreads'][number]['layout']
  }
}

/**
 * Normaliza un book crudo (de localStorage) a AlbumBlueprint.
 * Maneja formato nuevo (b.spreads + b.cover + b.occasion) y viejo (b.content.spreads).
 * Garantiza consistencia entre viewer y editor — toda la lógica de normalize vive aquí.
 *
 * @param raw  Book crudo de localStorage (puede ser cualquier formato histórico)
 * @param idOverride  Si se provee, sobreescribe el id del book (útil cuando el editor lee con id del URL)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeBook(raw: any, idOverride?: string): AlbumBlueprint {
  // Formato nuevo: ya es AlbumBlueprint, solo parchar cover y hidratar Maps
  if (raw.spreads && raw.cover && raw.occasion) {
    const occasion = raw.occasion || 'boda'
    const defaultTemplate = getDefaultTemplate(occasion)
    const cover = raw.cover
    return {
      ...raw,
      id: idOverride ?? raw.id,
      cover: {
        photoId: cover.photoId || '',
        templateId: cover.templateId || defaultTemplate.id,
        title: cover.title || raw.narrative?.title || 'Mi álbum',
        subtitle: cover.subtitle || '',
        date: cover.date || '',
        textPosition: cover.textPosition || defaultTemplate.defaultPosition,
        textAlign: cover.textAlign || defaultTemplate.defaultAlign,
        textColor: cover.textColor || 'auto',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layoutConfig: Array.isArray(raw.layoutConfig) ? new Map(raw.layoutConfig as any) : new Map(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      placements: Array.isArray(raw.placements) ? new Map(raw.placements as any) : new Map(),
      manualPhotoOrder: Array.isArray(raw.manualPhotoOrder) ? raw.manualPhotoOrder : undefined,
    } as AlbumBlueprint
  }

  // Formato viejo: content.spreads con photo.src (no url)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldSpreads = raw.content?.spreads ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spreads = oldSpreads.map((s: any, i: number) => ({
    id: s.id ?? `spread-${i}`,
    act: s.act ?? 'inicio',
    layout: mapOldLayout(s.layout),
    isLocked: false,
    pageNumber: i * 2 + 1,
    caption: s.caption,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    photos: (s.photos ?? []).map((p: any) => ({
      id: p.id,
      url: p.url ?? p.src ?? p.thumbnailUrl ?? '',
      thumbnailUrl: p.thumbnailUrl ?? p.url ?? p.src ?? '',
      r2Key: p.r2Key || '',
      width: p.width || 0,
      height: p.height || 0,
      orientation: (p.orientation ?? 'landscape') as 'landscape' | 'portrait' | 'square',
      originalName: p.originalName ?? p.id,
      score: p.score || {
        sharpness: 0, exposure: 0, composition: 0, faces: 0,
        resolution: 0, uniqueness: 100, emotionalWeight: 50,
        finalScore: 50, recommendation: 'supporting' as const,
      },
    })),
  }))

  const occasion = raw.occasion || raw.identity?.occasion || 'boda'
  const defaultTemplate = getDefaultTemplate(occasion)
  const title = raw.identity?.title ?? 'Mi álbum'
  const coverPhotoId = spreads[0]?.photos[0]?.id ?? ''

  // Priorizar raw.cover (raíz) porque ahí guarda handleSave del editor
  const rawCover = raw.cover || raw.content?.cover || raw.identity || {}

  return {
    id: idOverride ?? raw.identity?.bookId ?? `book-${Date.now()}`,
    sessionId: raw.identity?.bookId ?? '',
    createdAt: new Date(raw.identity?.createdAt ?? Date.now()),
    updatedAt: new Date(),
    version: 1,
    format: raw.format || raw.identity?.format || '30x30',
    style: raw.style || raw.identity?.style || 'con-margen',
    occasion,
    pageCount: spreads.length * 2,
    cover: {
      photoId: rawCover.photoId || coverPhotoId,
      templateId: rawCover.templateId || defaultTemplate.id,
      title: rawCover.title || raw.narrative?.title || title,
      subtitle: rawCover.subtitle && rawCover.subtitle !== (raw.narrative?.title || raw.identity?.title)
        ? rawCover.subtitle
        : '',
      date: rawCover.date || '',
      textPosition: rawCover.textPosition || defaultTemplate.defaultPosition,
      textAlign: rawCover.textAlign || defaultTemplate.defaultAlign,
      textColor: rawCover.textColor || 'auto',
    },
    spreads,
    narrative: {
      title,
      summary: raw.editorial?.summary ?? '',
      tone: raw.editorial?.tone ?? '',
    },
    status: 'preview',
    aiGenerated: raw.provenance?.source?.includes('ai') ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layoutConfig: Array.isArray(raw.layoutConfig) ? new Map(raw.layoutConfig as any) : new Map(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placements: Array.isArray(raw.placements) ? new Map(raw.placements as any) : new Map(),
    manualPhotoOrder: Array.isArray(raw.manualPhotoOrder) ? raw.manualPhotoOrder : undefined,
  } as AlbumBlueprint
}
