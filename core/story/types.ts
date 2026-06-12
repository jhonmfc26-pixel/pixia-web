/**
 * Tipos narrativos del Story Model de Pixia.
 *
 * Representan el significado humano de un conjunto de fotos:
 * quiénes aparecen, qué momentos ocurrieron, qué foto lo resume mejor.
 * Son la fuente de verdad que el editorial y el texto narrativo consumen.
 */

/** Tipo de ocasión que origina el álbum — define el tono narrativo global. */
export type OccasionType =
  | 'boda'
  | 'viaje'
  | 'bebe'
  | 'aniversario'
  | 'familia'
  | 'mascota'

/**
 * Qué rol juega una foto dentro del relato.
 * - `climax`: el momento cumbre; si el álbum fuera una película, sería el fotograma del póster.
 * - `transition`: une dos capítulos o momentos, da respiración a la historia.
 * - `context`: establece lugar o ambiente sin ser protagonista.
 * - `detail`: acercamiento expresivo — manos, ojos, texturas que dan emoción.
 */
export type PhotoRole = 'climax' | 'transition' | 'context' | 'detail'

/**
 * Región de la imagen que carga significado narrativo.
 * Permite al sistema de crops saber qué puede sacrificar y qué no.
 */
export interface MeaningRegion {
  /** Identificador único dentro de la foto. */
  id: string
  /** Coordenadas normalizadas (0–1 relativo al ancho/alto de la imagen). */
  rect: {
    x: number
    y: number
    w: number
    h: number
  }
  /**
   * Jerarquía de sacrificio en un crop:
   * - `essential`: nunca recortar (cara principal, sujeto del título).
   * - `valuable`: preservar si hay espacio; aceptable perder con justificación.
   * - `sacrificable`: fondo o decorado que puede desaparecer sin perder la historia.
   */
  priority: 'essential' | 'valuable' | 'sacrificable'
  /** Categoría semántica del contenido de la región. */
  kind: 'person' | 'group' | 'subject' | 'landscape' | 'detail'
}

/**
 * Un capítulo es un bloque temporal coherente de la historia:
 * "la llegada", "la ceremonia", "la fiesta".
 * Claude asigna un título después; durante el análisis el capítulo existe sin él.
 */
export interface Chapter {
  id: string
  /** Título generado por Claude una vez que conoce el contenido del capítulo. */
  title?: string
  /** Ventana temporal del capítulo, extraída de EXIF. */
  timeRange: {
    start: string  // ISO 8601
    end: string    // ISO 8601
  }
  /** Ubicación aproximada del capítulo (si hay GPS en los EXIF). */
  location?: {
    lat: number
    lng: number
    /** Nombre legible del lugar, p. ej. "Cartagena, Colombia". */
    label?: string
  }
  /** IDs de todas las fotos que pertenecen a este capítulo. */
  photoIds: string[]
  /**
   * La foto que un humano elegiría para resumir este momento en una sola imagen.
   * Candidata natural a hero-spread o portada de capítulo.
   */
  climaxPhotoId?: string
}

/**
 * Una persona reconocida en el conjunto de fotos.
 * Permanece anónima ("persona-1") hasta que el usuario la nombra.
 */
export interface Person {
  id: string
  /** Nombre o alias que el usuario asigna; vacío hasta que lo hace. */
  label?: string
  /** IDs de las fotos en las que aparece esta persona. */
  photoIds: string[]
  /**
   * Qué tan central es esta persona en la historia: 0 = aparición puntual, 1 = protagonista total.
   * Se calcula por frecuencia de aparición y posición (tamaño de región / centralidad).
   */
  prominence: number  // 0–1
}

/**
 * Metadata narrativa de una foto individual dentro de la historia.
 * Complementa los datos ópticos (score, orientación) con significado.
 */
export interface PhotoStoryEntry {
  photoId: string
  /** A qué capítulo pertenece esta foto (puede estar sin asignar durante el análisis). */
  chapterId?: string
  /** IDs de personas reconocidas en esta foto. */
  personIds: string[]
  /** Rol narrativo de la foto dentro del relato. */
  role: PhotoRole
  /**
   * Zonas de la imagen con carga semántica.
   * El motor de crops las usa para decidir qué preservar al adaptar al layout.
   */
  meaningRegions?: MeaningRegion[]
  /**
   * Hacia dónde miran los sujetos principales.
   * Útil para layouts de doble página: mirar hacia el interior da cohesión visual.
   */
  gazeDirection?: 'left' | 'right' | 'center'
}

/**
 * Modelo de historia de un álbum Pixia.
 *
 * Es la representación semántica completa de un conjunto de fotos:
 * quién aparece, cuándo y dónde sucedió cada momento,
 * y qué importancia narrativa tiene cada imagen.
 *
 * Todos los consumidores (editorial engine, generador de texto, crop system)
 * leen este contrato — nunca acceden directamente a los archivos originales.
 */
export interface StoryModel {
  id: string
  /** ID de la sesión del wizard que originó este modelo. */
  sessionId: string
  createdAt: string  // ISO 8601
  /**
   * Versión del esquema. Incrementar cuando el contrato cambie de forma incompatible.
   * Consumidores pueden rechazar versiones que no reconocen.
   */
  version: number
  /** Tipo de ocasión que define el tono y las convenciones narrativas del álbum. */
  occasion: OccasionType
  /**
   * Bloques temporales de la historia, ordenados cronológicamente.
   * Cada capítulo es un "acto" del relato.
   */
  chapters: Chapter[]
  /**
   * Personas identificadas en el álbum, ordenadas por prominencia descendente.
   * El protagonista principal siempre estará primero.
   */
  people: Person[]
  /**
   * Una entrada por foto con su interpretación narrativa.
   * Orden cronológico de CAPTURA — la secuencia del álbum es decisión
   * editorial (EditorialPlan.sequence), nunca del story.
   */
  photos: PhotoStoryEntry[]
}
