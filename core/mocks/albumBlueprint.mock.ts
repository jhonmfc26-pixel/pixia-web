// core/mocks/albumBlueprint.mock.ts

import { AlbumBlueprint } from '../editorial/albumBlueprint'

export const albumBlueprintMock: AlbumBlueprint = {
  albumId: 'pixia-demo-001',

  narrative: {
    tone: 'emocional',
    acts: [
      {
        id: 'inicio',
        description: 'Un comienzo sereno que introduce el momento sin prisa.'
      },
      {
        id: 'desarrollo',
        description: 'La historia se expande con gestos cotidianos y miradas sinceras.'
      },
      {
        id: 'climax',
        description: 'El punto más intenso del álbum, donde la emoción alcanza su máxima expresión.'
      },
      {
        id: 'cierre',
        description: 'Un final calmo que deja espacio para la memoria.'
      }
    ]
  },

  style: {
    name: 'Natural Editorial',
    colorScheme: 'light',
    typography: 'serif'
  },

  decisions: [
    {
      reason: 'Priorizamos fotos con contacto visual para construir una narrativa más íntima.'
    },
    {
      reason: 'El clímax se ubicó en el centro del álbum para reforzar el impacto emocional.'
    },
    {
      reason: 'Se eligieron layouts amplios para permitir que las imágenes respiren.'
    }
  ],

  spreads: [
    {
      id: 'spread-01',
      act: 'inicio',
      layout: 'single-full',
      photos: [{ id: 'p1', src: '/mock/photos/01.jpg' }]
    },
    {
      id: 'spread-02',
      act: 'desarrollo',
      layout: 'double-balanced',
      photos: [
        { id: 'p2', src: '/mock/photos/02.jpg' },
        { id: 'p3', src: '/mock/photos/03.jpg' }
      ]
    },
    {
      id: 'spread-03',
      act: 'climax',
      layout: 'double-impact',
      photos: [
        { id: 'p4', src: '/mock/photos/04.jpg' },
        { id: 'p5', src: '/mock/photos/05.jpg' }
      ]
    },
    {
      id: 'spread-04',
      act: 'cierre',
      layout: 'single-minimal',
      photos: [{ id: 'p6', src: '/mock/photos/06.jpg' }]
    }
  ]
}
