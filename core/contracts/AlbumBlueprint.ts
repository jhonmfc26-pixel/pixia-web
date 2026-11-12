import type { LayoutId } from '@/core/modules/album/layouts/registry'
import type { AlbumStructure } from '@/core/modules/foldModel/types'

export type PhotoOrientation = 'landscape' | 'portrait' | 'square'

export type ActId = 'inicio' | 'desarrollo' | 'climax' | 'cierre'

export type AlbumStyle = 'con-margen' | 'sin-margen'

export type AlbumFormat = '20x20' | '30x30' | 'a4'

export type OccasionType =
  | 'boda'
  | 'bebe-mensual'
  | 'viaje'
  | 'aniversario'
  | 'familia'
  | 'mascota'

export type CoverStyle =
  | 'classic'   // Foto + texto serif blanco
  | 'minimal'   // Fondo oscuro + texto
  | 'bold'      // Foto full + nombre grande
  | 'soft'      // Foto con overlay suave

export type BlueprintStatus =
  | 'draft'
  | 'preview'
  | 'paid'
  | 'ai-processing'
  | 'pdf-ready'
  | 'sent-to-print'
  | 'printing'
  | 'shipped'
  | 'delivered'

export type PhotoRecommendation = 'hero' | 'supporting' | 'discard'

export interface PhotoScore {
  sharpness: number       // 0-25
  exposure: number        // 0-20
  composition: number     // 0-20
  faces: number           // 0-20
  resolution: number      // 0-15
  uniqueness: number      // 0-100 (qué tan diferente es de otras)
  emotionalWeight: number // 0-100
  finalScore: number      // 0-100 ponderado
  recommendation: PhotoRecommendation
}

export interface MeaningRegion {
  type: 'face'
  rect: { x: number; y: number; w: number; h: number }  // coordenadas normalizadas 0-1
}

export interface PhotoAsset {
  id: string              // UUID único — NUNCA se repite en el álbum
  r2Key: string           // Clave en Cloudflare R2
  url: string             // URL para mostrar
  thumbnailUrl: string    // 400px para previews
  width: number
  height: number
  orientation: PhotoOrientation
  score: PhotoScore
  takenAt?: string | Date | null // EXIF timestamp
  gps?: { lat: number; lng: number }
  originalName: string
  meaningRegions?: MeaningRegion[]
  /** SHA-256 del contenido del archivo original — usado para deduplicar uploads. Ausente en fotos pre-existentes a esta feature. */
  contentHash?: string
}

export interface Spread {
  id: string
  act: ActId
  layout: LayoutId
  photos: PhotoAsset[]    // IDs únicos garantizados
  caption?: string
  isLocked: boolean
  pageNumber: number
}

export interface CoverConfig {
  photoId: string
  templateId: string
  title: string
  subtitle?: string
  date?: string
  textPosition: 'top' | 'center' | 'bottom'
  textAlign: 'left' | 'center' | 'right'
  textColor: 'auto' | 'light' | 'dark'
  // ── Estudio de portada (2026-11-12). Todo opcional: sin estos campos la
  //    portada se ve como antes. Ver core/modules/cover/coverDesign.ts.
  /** 'photo' = foto a sangre (por defecto); 'graphic' = color + ilustración, sin foto. */
  kind?: 'photo' | 'graphic'
  /** Id de COVER_FONTS. Sin valor = la fuente de la plantilla. */
  fontId?: string
  /** Color del título y textos (#RRGGBB). Tiene prioridad sobre textColor. */
  fg?: string
  /** Fondo de la tapa gráfica y color del lomo y la contraportada (#RRGGBB). */
  bg?: string
  /** Color de detalles de la ilustración (#RRGGBB). */
  accent?: string
  /** Id de COVER_ART (solo tapa gráfica). */
  artId?: string
  /** Tamaño del título relativo a la plantilla (0.82 / 1 / 1.18). */
  titleScale?: number
}

export interface AlbumBlueprint {
  id: string
  userId?: string         // null si es sesión anónima
  sessionId: string       // siempre existe
  createdAt: Date
  updatedAt: Date
  version: number

  format: AlbumFormat
  /** Identificador del formato físico. Si no se especifica, default 'square-30'. */
  formatId?: string
  style: AlbumStyle
  occasion: OccasionType
  pageCount: number

  cover: CoverConfig
  spreads: Spread[]

  narrative: {
    title: string
    summary: string
    tone: string
  }

  status: BlueprintStatus
  aiGenerated: boolean
  purchaseId?: string

  /**
   * Estructura mutable del álbum guardada desde el editor v2.
   * JSON-serializable por diseño. Ausente en blueprints pre-editV2.
   */
  structure?: AlbumStructure
}

// Eventos del funnel para métricas
export type FunnelEvent =
  | 'session_started'
  | 'occasion_selected'
  | 'photos_uploaded'
  | 'scoring_completed'
  | 'preview_viewed'
  | 'editor_opened'
  | 'checkout_started'
  | 'purchase_completed'
  | 'album_received'
  | 'repeat_purchase'
