import { PDFDocument } from 'pdf-lib'
import type { ReactElement } from 'react'
import type { AlbumStructure, Face } from '@/core/modules/foldModel/types'
import type { CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { PrintProfile } from './printProfiles'
import { checkSlotDpi, type DpiWarning } from './dpiCheck'
import { PrintFace, PrintHeroSpreadHalf } from './PrintFacePage'
import PrintCoverWrap, { getCoverWrapDimensionsMm } from './PrintCoverWrap'
import { wrapPrintPageHtml } from './renderPrintHtml'
import { countRealPages } from '@/core/modules/foldModel/validate'
import type { HtmlToPdfRenderer } from './htmlToPdfRenderer'

export interface GeneratePdfResult {
  pdf: Uint8Array
  warnings: DpiWarning[]
}

interface GenerateContext {
  profile: PrintProfile
  renderer: HtmlToPdfRenderer
  /** Origen real de la app — ver wrapPrintPageHtml. */
  baseUrl: string
}

export interface PageDescriptor {
  html: string
  widthMm: number
  heightMm: number
  warnings: DpiWarning[]
}

export interface PageElement {
  element: ReactElement
  needsFonts: boolean
  warnings: DpiWarning[]
}

/**
 * Arma el HTML (renderToStaticMarkup) de CADA página física del interior,
 * en orden, SIN renderizarlas a PDF — a diferencia de generateInteriorPdf,
 * que hace todo (armar + renderizar + acumular + merge) en una sola pasada.
 * Separado para poder generar por LOTES: armar el HTML de todas las páginas
 * es barato (son strings), lo caro es el round-trip al browser — eso lo hace
 * el caller, página por página o en chunks, liberando memoria entre cada una
 * en vez de acumular todo antes de tocar pdf-lib (ver PROBLEMA de OOM
 * documentado en workers/pdf-render/src/index.ts).
 */
export function buildInteriorPages(
  structure: AlbumStructure,
  photosById: Map<string, PhotoAsset>,
  ctx: { profile: PrintProfile; baseUrl: string },
): PageDescriptor[] {
  const { profile, baseUrl } = ctx
  const widthMm = profile.widthMm + 2 * profile.bleedMm
  const heightMm = profile.heightMm + 2 * profile.bleedMm

  const collectFaceWarnings = (face: Face): DpiWarning[] => {
    if (face.kind === 'dedication' || face.isEmpty) return []
    const warnings: DpiWarning[] = []
    face.photoIds.forEach((photoId, slotIndex) => {
      const photo = photosById.get(photoId)
      if (!photo || !photo.width || !photo.height) return
      const warning = checkSlotDpi({
        photoId,
        photoWidthPx: photo.width,
        photoHeightPx: photo.height,
        layoutId: face.layout,
        slotIndex,
        pageWidthMm: widthMm,
        pageHeightMm: heightMm,
        targetDpi: profile.dpi,
      })
      if (warning) warnings.push(warning)
    })
    return warnings
  }

  const pages: PageDescriptor[] = []
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      for (const face of [fold.left, fold.right]) {
        const warnings = collectFaceWarnings(face)
        const html = wrapPrintPageHtml(
          <PrintFace face={face} photosById={photosById} profile={profile} />,
          { widthMm, heightMm, baseUrl, needsFonts: face.kind === 'dedication' },
        )
        pages.push({ html, widthMm, heightMm, warnings })
      }
    } else {
      for (const half of ['left', 'right'] as const) {
        const html = wrapPrintPageHtml(
          <PrintHeroSpreadHalf face={fold.face} photosById={photosById} half={half} profile={profile} />,
          { widthMm, heightMm, baseUrl }, // hero-spread: siempre 1 foto, nunca texto
        )
        pages.push({ html, widthMm, heightMm, warnings: [] })
      }
    }
  }
  return pages
}

/**
 * Igual que buildInteriorPages pero devuelve los ELEMENTOS de React sin
 * envolverlos en un documento HTML completo cada uno — para el motor de
 * render en una sola pasada (contenedor Playwright, ver
 * services/pdf-render-container/): un único documento con TODAS las páginas
 * (separadas por salto de página CSS) en vez de N documentos + merge. No
 * toca buildInteriorPages (se conserva tal cual para el Worker CF).
 */
export function buildInteriorPageElements(
  structure: AlbumStructure,
  photosById: Map<string, PhotoAsset>,
  ctx: { profile: PrintProfile },
): { pages: PageElement[]; widthMm: number; heightMm: number } {
  const { profile } = ctx
  const widthMm = profile.widthMm + 2 * profile.bleedMm
  const heightMm = profile.heightMm + 2 * profile.bleedMm

  const collectFaceWarnings = (face: Face): DpiWarning[] => {
    if (face.kind === 'dedication' || face.isEmpty) return []
    const warnings: DpiWarning[] = []
    face.photoIds.forEach((photoId, slotIndex) => {
      const photo = photosById.get(photoId)
      if (!photo || !photo.width || !photo.height) return
      const warning = checkSlotDpi({
        photoId,
        photoWidthPx: photo.width,
        photoHeightPx: photo.height,
        layoutId: face.layout,
        slotIndex,
        pageWidthMm: widthMm,
        pageHeightMm: heightMm,
        targetDpi: profile.dpi,
      })
      if (warning) warnings.push(warning)
    })
    return warnings
  }

  const pages: PageElement[] = []
  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      for (const face of [fold.left, fold.right]) {
        pages.push({
          element: <PrintFace face={face} photosById={photosById} profile={profile} />,
          needsFonts: face.kind === 'dedication',
          warnings: collectFaceWarnings(face),
        })
      }
    } else {
      for (const half of ['left', 'right'] as const) {
        pages.push({
          element: <PrintHeroSpreadHalf face={fold.face} photosById={photosById} half={half} profile={profile} />,
          needsFonts: false, // hero-spread: siempre 1 foto, nunca texto
          warnings: [],
        })
      }
    }
  }
  return { pages, widthMm, heightMm }
}

/** Misma idea que buildInteriorPages pero para la única página de la cubierta extendida. */
export function buildCoverPage(
  cover: CoverConfig,
  coverPhoto: PhotoAsset | undefined,
  structure: AlbumStructure,
  ctx: { profile: PrintProfile; baseUrl: string },
): PageDescriptor {
  const { profile, baseUrl } = ctx
  const pageCount = countRealPages(structure)
  const { widthMm, heightMm } = getCoverWrapDimensionsMm(profile, pageCount)
  const title = cover.title ?? ''
  const html = wrapPrintPageHtml(
    <PrintCoverWrap cover={cover} coverPhoto={coverPhoto} title={title} pageCount={pageCount} profile={profile} />,
    { widthMm, heightMm, baseUrl, needsFonts: true }, // título/subtítulo/lomo — siempre puede tener texto
  )
  return { html, widthMm, heightMm, warnings: [] }
}

/**
 * PDF del interior — una página física por cada Face (o por cada mitad de
 * un hero-spread), en el MISMO orden que recorre structure.folds. Cada
 * página se renderiza y se convierte a PDF de forma INDEPENDIENTE (una
 * llamada a renderer.renderPageToPdf por página) y se unen al final con
 * pdf-lib — deliberado: en vez de apostar la generación entera de un álbum
 * de 60+ páginas a una sola sesión de browser larga (con el riesgo de
 * límite de duración que tiene Cloudflare Browser Rendering), cada página
 * es una unidad de trabajo chica e independiente. Si una falla, se puede
 * reintentar SOLO esa, no el álbum entero.
 */
export async function generateInteriorPdf(
  structure: AlbumStructure,
  photosById: Map<string, PhotoAsset>,
  ctx: GenerateContext,
): Promise<GeneratePdfResult> {
  const { profile, renderer, baseUrl } = ctx
  const widthMm = profile.widthMm + 2 * profile.bleedMm
  const heightMm = profile.heightMm + 2 * profile.bleedMm

  const warnings: DpiWarning[] = []
  const collectFaceWarnings = (face: Face) => {
    if (face.kind === 'dedication' || face.isEmpty) return
    face.photoIds.forEach((photoId, slotIndex) => {
      const photo = photosById.get(photoId)
      if (!photo || !photo.width || !photo.height) return
      const warning = checkSlotDpi({
        photoId,
        photoWidthPx: photo.width,
        photoHeightPx: photo.height,
        layoutId: face.layout,
        slotIndex,
        pageWidthMm: widthMm,
        pageHeightMm: heightMm,
        targetDpi: profile.dpi,
      })
      if (warning) warnings.push(warning)
    })
  }

  const pagePdfs: Uint8Array[] = []

  for (const fold of structure.folds) {
    if (fold.kind === 'paired') {
      for (const face of [fold.left, fold.right]) {
        collectFaceWarnings(face)
        const html = wrapPrintPageHtml(
          <PrintFace face={face} photosById={photosById} profile={profile} />,
          { widthMm, heightMm, baseUrl, needsFonts: face.kind === 'dedication' },
        )
        pagePdfs.push(await renderer.renderPageToPdf(html, widthMm, heightMm))
      }
    } else {
      // Composition (hero-spread): SIEMPRE las 2 mitades, [izquierda, derecha],
      // consecutivas — ver la convención documentada en PrintFacePage.tsx.
      // No hay warning de DPI acá todavía: un hero-spread es 1 foto cruzando
      // 2 páginas físicas completas, el cálculo de slot de checkSlotDpi
      // (pensado para layouts de grid con múltiples fotos) no aplica tal
      // cual — se puede sumar en un ajuste chico aparte si hace falta.
      for (const half of ['left', 'right'] as const) {
        const html = wrapPrintPageHtml(
          <PrintHeroSpreadHalf face={fold.face} photosById={photosById} half={half} profile={profile} />,
          { widthMm, heightMm, baseUrl }, // hero-spread: siempre 1 foto, nunca texto
        )
        pagePdfs.push(await renderer.renderPageToPdf(html, widthMm, heightMm))
      }
    }
  }

  return { pdf: await mergeSinglePagePdfs(pagePdfs), warnings }
}

/**
 * PDF de la cubierta extendida — una sola página física (grande: portada +
 * lomo + contraportada de un tirón). structure se pide explícito (no se
 * deriva de book.pageCount, que puede estar desactualizado respecto a los
 * pliegos reales del editor — ver countRealPages) — el caller ya tiene que
 * haber cargado y validado la structure real para llegar hasta acá.
 */
export async function generateCoverPdf(
  cover: CoverConfig,
  coverPhoto: PhotoAsset | undefined,
  structure: AlbumStructure,
  ctx: GenerateContext,
): Promise<GeneratePdfResult> {
  const { profile, renderer, baseUrl } = ctx
  const pageCount = countRealPages(structure)
  const { widthMm, heightMm } = getCoverWrapDimensionsMm(profile, pageCount)
  const title = cover.title ?? ''

  const html = wrapPrintPageHtml(
    <PrintCoverWrap cover={cover} coverPhoto={coverPhoto} title={title} pageCount={pageCount} profile={profile} />,
    { widthMm, heightMm, baseUrl, needsFonts: true },
  )
  const pdf = await renderer.renderPageToPdf(html, widthMm, heightMm)
  return { pdf, warnings: [] }
}

async function mergeSinglePagePdfs(pagePdfs: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  for (const bytes of pagePdfs) {
    const doc = await PDFDocument.load(bytes)
    const [page] = await merged.copyPages(doc, [0])
    merged.addPage(page)
  }
  return merged.save()
}
