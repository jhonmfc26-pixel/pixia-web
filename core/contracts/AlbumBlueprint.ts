export type PhotoOrientation = 'landscape' | 'portrait' | 'square'

export type LayoutType =
  | 'full'       // 1 foto página completa
  | 'double'     // 1 foto doble página (layflat)
  | 'duo-v'      // 2 fotos verticales
  | 'duo-h'      // 2 fotos horizontales
  | 'trio'       // 3 fotos
  | 'hero-2'     // 1 grande + 2 pequeñas
  | 'portrait'   // 1 vertical con aire

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

export interface PhotoAsset {
  id: string              // UUID único — NUNCA se repite en el álbum
  r2Key: string           // Clave en Cloudflare R2
  url: string             // URL para mostrar
  thumbnailUrl: string    // 400px para previews
  width: number
  height: number
  orientation: PhotoOrientation
  score: PhotoScore
  takenAt?: Date          // EXIF timestamp
  gps?: { lat: number; lng: number }
  originalName: string
}

export interface Spread {
  id: string
  act: ActId
  layout: LayoutType
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
}

export interface AlbumBlueprint {
  id: string
  userId?: string         // null si es sesión anónima
  sessionId: string       // siempre existe
  createdAt: Date
  updatedAt: Date
  version: number

  format: AlbumFormat
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
