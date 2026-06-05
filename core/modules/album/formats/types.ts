/**
 * Define las características técnicas de un producto físico de álbum.
 * Separado del contenido editorial (AlbumBlueprint) para que un mismo
 * book pueda imprimirse en distintos formatos sin reestructurar datos.
 */
export interface AlbumFormat {
  id: string

  /** Dimensiones físicas de UNA página */
  page: {
    widthCm: number
    heightCm: number
    /** Sangrado en milímetros. Reservado para futura implementación de bleed boxes. */
    bleedMm: number
  }

  /** Tipo de encuadernación. Determina cómo se compone el PDF. */
  binding: 'lay-flat'

  /** Configuración de salida de impresión */
  print: {
    /** Resolución para canvas rendering en PDF */
    dpi: number
  }
}
