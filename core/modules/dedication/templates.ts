import type { OccasionType } from '@/core/contracts/AlbumBlueprint'

/** Punto de partida editable al convertir una cara en dedicatoria — nunca el texto final. */
export interface DedicationTemplate {
  heading: string
  body: string
  signature: string
}

const GENERIC_TEMPLATE: DedicationTemplate = {
  heading: 'Para ti',
  body: 'Estas páginas guardan un pedazo de nuestra historia. Cada foto es un momento que decidimos no dejar pasar.',
  signature: 'Con cariño',
}

const DEDICATION_TEMPLATES: Partial<Record<OccasionType, DedicationTemplate>> = {
  boda: {
    heading: 'Nuestro día',
    body: 'Elegimos empezar esta historia juntos, y quisimos guardar cada instante para volver a él cuantas veces queramos.',
    signature: 'Con todo nuestro amor',
  },
  'bebe-mensual': {
    heading: 'Para ti, pequeño',
    body: 'Cada mes trajo algo nuevo que descubrir. Este álbum guarda ese primer año que pasó tan rápido y que atesoraremos siempre.',
    signature: 'Con todo nuestro amor',
  },
  viaje: {
    heading: 'Este viaje',
    body: 'De cada lugar nos llevamos algo distinto. Estas páginas son la forma de no dejar que ese recorrido se quede solo en la memoria.',
    signature: 'Hasta el próximo viaje',
  },
  aniversario: {
    heading: 'Un año más',
    body: 'Cada año suma una historia nueva a la nuestra. Este álbum es un recordatorio de todo lo que hemos construido juntos.',
    signature: 'Con cariño, siempre',
  },
  familia: {
    heading: 'Nuestra familia',
    body: 'Estos momentos son el hilo que nos une. Guardamos estas páginas para volver a ellas cuando queramos recordar quiénes somos.',
    signature: 'Con todo el cariño',
  },
  mascota: {
    heading: 'Nuestro compañero',
    body: 'Cada foto guarda un momento compartido. Este álbum es una forma de no olvidar cuánta alegría trajo a nuestros días.',
    signature: 'Con cariño',
  },
}

/** Plantilla según la ocasión del álbum, con fallback genérico. Todo editable después. */
export function getDedicationTemplate(occasion: OccasionType | undefined): DedicationTemplate {
  return (occasion && DEDICATION_TEMPLATES[occasion]) || GENERIC_TEMPLATE
}
