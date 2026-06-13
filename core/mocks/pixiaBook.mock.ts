import { PixiaBook } from '../domain/PixiaBook'

export const pixiaBookMock: PixiaBook = {
  identity: {
    bookId: 'pb-001',
    title: 'Un aniversario en la montaña',
    createdAt: new Date().toISOString(),
    version: 'v1'
  },

  editorial: {
    intent: 'celebration',
    tone: 'emocional',
    summary:
      'Un recorrido íntimo que comienza en calma y culmina en el momento más emotivo del viaje.',
    decisions: [
      {
        id: 'd1',
        reason: 'Ubicamos la imagen más expresiva en el clímax para reforzar impacto.'
      }
    ]
  },

  narrative: {
    acts: [
      {
        id: 'inicio',
        purpose: 'Introducir el ambiente y el contexto.',
        spreadIds: ['s1']
      },
      {
        id: 'desarrollo',
        purpose: 'Construir la historia progresivamente.',
        spreadIds: ['s2']
      },
      {
        id: 'climax',
        purpose: 'Punto emocional más alto.',
        spreadIds: ['s3']
      },
      {
        id: 'cierre',
        purpose: 'Cerrar con serenidad.',
        spreadIds: ['s4']
      }
    ]
  },

  physical: {
    format: 'PB-01',
    size: 'A4',
    orientation: 'vertical',
    paper: 'matte',
    cover: 'hard',
    totalSpreads: 4
  },

  content: {
    spreads: [
      {
        id: 's1',
        act: 'inicio',
        layout: 'single',
        photos: [{ id: 'p1', src: '/story/anniversary.jpg' }]
      },
      {
        id: 's2',
        act: 'desarrollo',
        layout: 'side-2',
        photos: [
          { id: 'p2', src: '/story/trip.jpg' },
          { id: 'p3', src: '/story/honeymoon.jpg' }
        ]
      },
      {
        id: 's3',
        act: 'climax',
        layout: 'single',
        photos: [{ id: 'p4', src: '/story/wedding.jpg' }]
      },
      {
        id: 's4',
        act: 'cierre',
        layout: 'single',
        photos: [{ id: 'p5', src: '/story/other.jpg' }]
      }
    ]
  },

  provenance: {
    source: 'wizard',
    photoCount: 5,
    signalsUsed: ['emocion', 'celebracion'],
    engineVersion: '1.0.0'
  }
}
