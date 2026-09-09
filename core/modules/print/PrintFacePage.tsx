import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { Face } from '@/core/modules/foldModel/types'
import type { PrintProfile } from './printProfiles'
import { FacePageView, HeroSpreadPageView } from '@/core/modules/viewer/SpreadFaces'

/**
 * Contenedor de UNA hoja física — tamaño real del PrintProfile INCLUYENDO
 * sangrado (el archivo que se manda a imprenta es más grande que la página
 * terminada; el trim/corte es responsabilidad de la imprenta, no de acá).
 * Sin chrome de pantalla: sin fondo gris del editor/viewer, sin sombra de
 * pliego, sin popover — eso vive en las páginas de app, no en esto.
 *
 * Cada PrintFace/PrintHeroSpreadHalf es EXACTAMENTE una página física — el
 * orquestador (generateAlbumPdfs.ts) genera un PDF de una sola página por
 * cada una de estas y las une con pdf-lib al final. Deliberado: así cada
 * página se renderiza y falla (o no) de forma independiente, en vez de
 * apostarlo todo a una sesión de browser gigante con 60+ páginas adentro.
 */
function PrintPageContainer({ profile, children }: { profile: PrintProfile; children: React.ReactNode }) {
  const widthMm = profile.widthMm + 2 * profile.bleedMm
  const heightMm = profile.heightMm + 2 * profile.bleedMm
  return (
    <div style={{
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      position: 'relative',
      overflow: 'hidden',
      background: '#fff',
    }}>
      {children}
    </div>
  )
}

/**
 * Una cara (mitad de un pliego "paired", o una dedicatoria, o un hueco
 * vacío) como página física impresa. FacePageView ya maneja los tres casos
 * — mismo componente que usa el viewer, sin el prop `side` (ese solo existe
 * para dibujar la sombra de lomo en pantalla, no aplica impreso).
 */
export function PrintFace({ face, photosById, profile }: {
  face: Face
  photosById: Map<string, PhotoAsset>
  profile: PrintProfile
}) {
  return (
    <PrintPageContainer profile={profile}>
      <FacePageView face={face} photosById={photosById} />
    </PrintPageContainer>
  )
}

/**
 * Una mitad de hero-spread (composition fold) — UNA foto que cruza dos
 * páginas físicas.
 *
 * CONVENCIÓN DE ENTREGA: Range imprime página por página (no admite un
 * archivo de doble ancho por spread), así que un hero-spread se exporta
 * como DOS páginas separadas del PDF — la mitad izquierda y la derecha,
 * SIEMPRE consecutivas y en ese orden dentro del PDF final. Al encuadernar
 * esas dos páginas una junto a la otra en su pliego, la foto vuelve a verse
 * continua a través del lomo — es la misma técnica de recorte al 200% que
 * ya usa HeroSpreadPageView en pantalla (mitad izquierda ancla por la
 * izquierda, mitad derecha ancla por la derecha, cada una muestra "su"
 * mitad de la foto completa). El orquestador es responsable de mantener
 * ese orden — ver el comentario en generateAlbumPdfs.ts.
 */
export function PrintHeroSpreadHalf({ face, photosById, half, profile }: {
  face: Face
  photosById: Map<string, PhotoAsset>
  half: 'left' | 'right'
  profile: PrintProfile
}) {
  return (
    <PrintPageContainer profile={profile}>
      <HeroSpreadPageView face={face} photosById={photosById} half={half} />
    </PrintPageContainer>
  )
}
