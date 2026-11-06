/**
 * Contenido visual de la home: qué páginas de álbum se muestran y con qué
 * fotos. Para cambiar las fotos (p.ej. por las profesionales), reemplazar
 * los archivos en /public/showcase/ con el MISMO nombre, o editar las rutas
 * acá. `position` ajusta el encuadre (CSS object-position) si hace falta.
 *
 * Los layouts son ids reales del motor (core/modules/album/layouts) — la
 * home muestra la geometría exacta de las páginas que se imprimen.
 *
 * Fotos actuales: provisionales (stock). Reemplazar por fotos reales de
 * álbumes Pixia o la sesión profesional.
 */

export interface ShowcasePhoto {
  src: string
  alt: string
  position?: string
}

export interface ShowcasePage {
  layout: string
  photos: ShowcasePhoto[]
  /** Cargar sin esperar al scroll (solo lo que se ve arriba de todo). */
  eager?: boolean
}

export interface ShowcaseSpread {
  alt: string
  left: ShowcasePage
  right: ShowcasePage
}

const P = {
  bodaPaseo: { src: '/showcase/boda-paseo.jpg', alt: 'Novios caminando de la mano al atardecer' },
  bodaBeso: { src: '/showcase/boda-beso.jpg', alt: 'Novios besándose' },
  playa: { src: '/showcase/playa.jpg', alt: 'Pareja caminando por la playa' },
  aniversario: { src: '/showcase/aniversario.jpg', alt: 'Pareja celebrando su aniversario' },
  viaje: { src: '/showcase/viaje-carretera.jpg', alt: 'Camioneta en una carretera de montaña' },
  recuerdos: { src: '/showcase/recuerdos.jpg', alt: 'Manos sosteniendo fotos impresas' },
} satisfies Record<string, ShowcasePhoto>

/** Spread del hero: lo primero que ve el visitante. */
export const HERO_SPREAD: ShowcaseSpread = {
  alt: 'Álbum Pixia abierto: una foto de boda a página completa y dos fotos de la pareja en la página siguiente',
  left: { layout: 'single', photos: [{ ...P.bodaPaseo, position: '50% 40%' }], eager: true },
  right: { layout: 'stack-2', photos: [{ ...P.bodaBeso, position: '50% 30%' }, { ...P.playa, position: '50% 60%' }], eager: true },
}

/** Sección "Así se ve un álbum Pixia". */
export const SHOWCASE: { title: string; text: string; spread: ShowcaseSpread }[] = [
  {
    title: 'Los grandes momentos, a página completa',
    text: 'Pixia reconoce tus mejores fotos y les da el espacio que merecen.',
    spread: {
      alt: 'Spread con una foto de viaje a página completa y otra con margen',
      left: { layout: 'single', photos: [{ ...P.viaje, position: '60% 50%' }] },
      right: { layout: 'solo-landscape-air', photos: [P.playa] },
    },
  },
  {
    title: 'Respiro para lo íntimo',
    text: 'Páginas con aire, como en un libro de autor, para que cada foto se lea sola.',
    spread: {
      alt: 'Spread con dos fotos enmarcadas con margen de papel',
      left: { layout: 'duo-landscape-air', photos: [P.aniversario, P.recuerdos] },
      right: { layout: 'single', photos: [{ ...P.bodaBeso, position: '50% 35%' }] },
    },
  },
  {
    title: 'Un ritmo que cambia página a página',
    text: 'Nada de cuadrículas repetidas: cada página se diseña según tus fotos.',
    spread: {
      alt: 'Spread con una composición de tres fotos y otra de dos',
      left: { layout: 'hero-2-bottom', photos: [{ ...P.playa, position: '50% 55%' }, P.aniversario, P.recuerdos] },
      right: { layout: 'side-2', photos: [{ ...P.bodaPaseo, position: '45% 40%' }, { ...P.bodaBeso, position: '50% 30%' }] },
    },
  },
]
