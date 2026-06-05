'use client'

import { PDFDocument } from 'pdf-lib'
import type { AlbumBlueprint, PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, PhotoPlacement, Page } from '@/core/modules/album/types'
import { DEFAULT_PLACEMENT } from '@/core/modules/album/types'
import { buildPages, extractPhotoPool } from '@/core/modules/album/pageEngine'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import type { LayoutSchema } from '@/core/modules/album/layouts/types'
import { getFormatById } from '@/core/modules/album/formats/registry'
import { cmToPt, ptToPxFactor } from '@/core/modules/album/formats/units'

// Gap y margen (replican el CSS del LayoutRenderer)
const GAP_CON_MARGEN_PT = 4 * 0.75
const GAP_SIN_MARGEN_PT = 2 * 0.75
const MARGIN_CON_MARGEN_PT = 10 * 0.75

interface GeneratePdfOptions {
  book: AlbumBlueprint
  photosById: Map<string, PhotoAsset>
  layoutConfig: LayoutConfig
  placements: Map<string, PhotoPlacement>
}

// ============ NORMALIZACIÓN R2 ============
function normalizeR2Url(url: string): string {
  if (!url) return url
  if (url.includes('assets.pixiaa.com')) return url
  const m = url.match(/^https?:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/)
  return m ? `https://assets.pixiaa.com/${m[1]}` : url
}

// ============ PARSERS CSS GRID ============
function parseFractions(css: string): number[] {
  const parts = css.trim().split(/\s+/)
  const values = parts.map(p => {
    const m = p.match(/^([\d.]+)fr$/)
    return m ? parseFloat(m[1]) : 1
  })
  const total = values.reduce((a, b) => a + b, 0) || 1
  return values.map(v => v / total)
}

function parseAreas(css: string): string[][] {
  const rows = css.match(/"([^"]+)"/g) || []
  return rows.map(r => r.replace(/"/g, '').trim().split(/\s+/))
}

function parsePadding(value: string | undefined, total: number): number {
  if (!value) return 0
  const m = value.match(/^([\d.]+)%$/)
  return m ? (parseFloat(m[1]) / 100) * total : 0
}

interface SlotRect { x: number; y: number; w: number; h: number }

function getSlotCssRect(
  slot: string,
  layout: LayoutSchema,
  containerW: number,
  containerH: number,
  gap: number,
  outerMargin: number
): SlotRect | null {
  const areas = parseAreas(layout.grid.areas)
  const colFr = parseFractions(layout.grid.columns)
  const rowFr = parseFractions(layout.grid.rows)

  let rowStart = -1, rowEnd = -1, colStart = -1, colEnd = -1
  for (let r = 0; r < areas.length; r++) {
    for (let c = 0; c < areas[r].length; c++) {
      if (areas[r][c] === slot) {
        if (rowStart === -1 || r < rowStart) rowStart = r
        if (r > rowEnd) rowEnd = r
        if (colStart === -1 || c < colStart) colStart = c
        if (c > colEnd) colEnd = c
      }
    }
  }
  if (rowStart === -1) return null

  const effectiveMargin = layout.disableMargin ? 0 : outerMargin
  const availW = containerW - 2 * effectiveMargin
  const availH = containerH - 2 * effectiveMargin

  const innerPadW = layout.disableMargin ? 0 : parsePadding(layout.innerPadding, availW)
  const innerPadH = layout.disableMargin ? 0 : parsePadding(layout.innerPadding, availH)
  const innerW = availW - 2 * innerPadW
  const innerH = availH - 2 * innerPadH

  const colStarts = [0]
  for (const f of colFr) colStarts.push(colStarts[colStarts.length - 1] + f * innerW)
  const rowStarts = [0]
  for (const f of rowFr) rowStarts.push(rowStarts[rowStarts.length - 1] + f * innerH)

  const xCss = effectiveMargin + innerPadW + colStarts[colStart]
  const yCss = effectiveMargin + innerPadH + rowStarts[rowStart]
  const wCss = colStarts[colEnd + 1] - colStarts[colStart]
  const hCss = rowStarts[rowEnd + 1] - rowStarts[rowStart]

  const halfGap = gap / 2
  return {
    x: xCss + halfGap,
    y: yCss + halfGap,
    w: wCss - gap,
    h: hCss - gap,
  }
}

// ============ CANVAS RENDERING ============

interface RenderParams {
  url: string
  targetWPt: number
  targetHPt: number
  placement: PhotoPlacement
  ptToPx: number
  objectPositionOverride?: string
}

function parseObjectPosition(css: string): { x: number; y: number } {
  const keywords: Record<string, number> = {
    left: 0, top: 0, center: 50, right: 100, bottom: 100,
  }
  const parts = css.trim().split(/\s+/)
  const parse = (token: string): number => {
    const m = token.match(/^([\d.]+)%$/)
    if (m) return parseFloat(m[1])
    return token in keywords ? keywords[token] : 50
  }
  if (parts.length === 1) return { x: parse(parts[0]), y: 50 }
  return { x: parse(parts[0]), y: parse(parts[1]) }
}

async function renderImageToCanvasBytes(params: RenderParams): Promise<Uint8Array> {
  const { url, targetWPt, targetHPt, placement, ptToPx, objectPositionOverride } = params

  const hasOverride = !!objectPositionOverride
  const safeZoom = hasOverride ? 1 : Math.max(1, placement.zoom)

  let posX = 50, posY = 50
  if (hasOverride) {
    const parsed = parseObjectPosition(objectPositionOverride!)
    posX = parsed.x
    posY = parsed.y
  } else {
    posX = 50 + placement.offsetX
    posY = 50 + placement.offsetY
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`No se pudo cargar: ${url}`))
    img.src = url
  })

  const canvasW = Math.round(targetWPt * ptToPx)
  const canvasH = Math.round(targetHPt * ptToPx)
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear canvas context')

  const imgRatio = img.width / img.height
  const canvasRatio = canvasW / canvasH
  let srcW: number, srcH: number, srcX: number, srcY: number

  if (imgRatio > canvasRatio) {
    srcH = img.height
    srcW = srcH * canvasRatio
    srcX = ((img.width - srcW) * posX) / 100
    srcY = 0
  } else {
    srcW = img.width
    srcH = srcW / canvasRatio
    srcX = 0
    srcY = ((img.height - srcH) * posY) / 100
  }

  if (safeZoom > 1) {
    const zoomedW = srcW / safeZoom
    const zoomedH = srcH / safeZoom
    srcX += (srcW - zoomedW) / 2
    srcY += (srcH - zoomedH) / 2
    srcW = zoomedW
    srcH = zoomedH
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvasW, canvasH)

  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('Canvas toBlob falló'))
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)))
    }, 'image/jpeg', 0.95)
  })
}

// ============ RENDERIZADO DE PÁGINA EN SU AREA ============

async function renderPageInArea(
  pdfDoc: PDFDocument,
  pdfPage: import('pdf-lib').PDFPage,
  page: Page,
  photosById: Map<string, PhotoAsset>,
  placements: Map<string, PhotoPlacement>,
  areaX: number,
  areaY: number,
  areaW: number,
  areaH: number,
  albumStyle: AlbumStyle,
  pdfPageH: number,
  ptToPx: number
): Promise<void> {
  const layout = getLayoutById(page.layout)
  if (!layout) {
    console.warn('[PDF] Layout no encontrado:', page.layout)
    return
  }

  const gap = albumStyle === 'con-margen' ? GAP_CON_MARGEN_PT : GAP_SIN_MARGEN_PT
  const outerMargin = albumStyle === 'con-margen' ? MARGIN_CON_MARGEN_PT : 0

  const photoIds = page.photoIds || []

  for (let i = 0; i < layout.slots.length && i < photoIds.length; i++) {
    const slot = layout.slots[i]
    const photoId = photoIds[i]
    const photo = photosById.get(photoId)
    if (!photo?.url) continue

    const rect = getSlotCssRect(slot, layout, areaW, areaH, gap, outerMargin)
    if (!rect) continue

    const slotCfg = layout.slotConfig?.[i]
    const effectivePlacement = slotCfg?.disablePlacement
      ? DEFAULT_PLACEMENT
      : (placements.get(photo.id) ?? DEFAULT_PLACEMENT)

    try {
      const bytes = await renderImageToCanvasBytes({
        url: normalizeR2Url(photo.url),
        targetWPt: rect.w,
        targetHPt: rect.h,
        placement: effectivePlacement,
        ptToPx,
        objectPositionOverride: slotCfg?.objectPosition,
      })
      const img = await pdfDoc.embedJpg(bytes)

      const finalX = areaX + rect.x
      const finalYCss = areaY + rect.y
      const finalY = pdfPageH - finalYCss - rect.h

      pdfPage.drawImage(img, { x: finalX, y: finalY, width: rect.w, height: rect.h })
    } catch (err) {
      console.error(`[PDF] Error en slot ${slot} (page ${page.id}):`, err)
    }
  }
}

// ============ PORTADA ============

async function renderCoverPdf(
  pdfDoc: PDFDocument,
  book: AlbumBlueprint,
  photosById: Map<string, PhotoAsset>,
  pageWPt: number,
  pageHPt: number,
  ptToPx: number
): Promise<void> {
  const pdfPage = pdfDoc.addPage([pageWPt, pageHPt])

  const coverPhotoId = book.cover?.photoId
  if (!coverPhotoId) return
  const coverPhoto = photosById.get(coverPhotoId)
  if (!coverPhoto?.url) return

  try {
    const bytes = await renderImageToCanvasBytes({
      url: normalizeR2Url(coverPhoto.url),
      targetWPt: pageWPt,
      targetHPt: pageHPt,
      placement: DEFAULT_PLACEMENT,
      ptToPx,
    })
    const img = await pdfDoc.embedJpg(bytes)
    pdfPage.drawImage(img, { x: 0, y: 0, width: pageWPt, height: pageHPt })
  } catch (err) {
    console.error('[PDF] Error en portada:', err)
  }
}

// ============ MAIN ============

export async function generatePdfFromBook(opts: GeneratePdfOptions): Promise<Uint8Array> {
  const { book, photosById, layoutConfig, placements } = opts

  // Resolver formato del álbum (con fallback a default)
  const format = getFormatById((book as unknown as { formatId?: string }).formatId)
  const pageWPt = cmToPt(format.page.widthCm)
  const pageHPt = cmToPt(format.page.heightCm)
  const spreadWPt = pageWPt * 2
  const ptToPx = ptToPxFactor(format.print.dpi)

  console.log(`[PDF] Formato: ${format.id} (${format.page.widthCm}×${format.page.heightCm}cm @ ${format.print.dpi}DPI)`)

  const manualOrder = (book as unknown as { manualPhotoOrder?: string[] }).manualPhotoOrder
  const photoPool = extractPhotoPool(book.spreads, manualOrder)
  const { pages } = buildPages(photoPool, layoutConfig)

  const albumStyle: AlbumStyle = (book.style as AlbumStyle) ?? 'sin-margen'

  console.log('[PDF] Generando con', pages.length, 'páginas internas (', albumStyle, ')')

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(book.cover?.title || 'Mi álbum')
  pdfDoc.setCreator('Pixia')
  pdfDoc.setProducer('Pixia v1.0')

  await renderCoverPdf(pdfDoc, book, photosById, pageWPt, pageHPt, ptToPx)

  let i = 0
  let spreadIdx = 0
  while (i < pages.length) {
    const leftPage = pages[i]
    const rightPage = pages[i + 1]

    spreadIdx++
    const layoutLeft = getLayoutById(leftPage.layout)

    // hero-spread: ambas páginas comparten foto
    if (
      layoutLeft?.scope === 'spread' &&
      rightPage &&
      leftPage.layout === rightPage.layout &&
      leftPage.photoIds[0] === rightPage.photoIds[0]
    ) {
      console.log(`[PDF] Spread ${spreadIdx} (hero-spread)`)
      const spreadPage = pdfDoc.addPage([spreadWPt, pageHPt])
      const photo = photosById.get(leftPage.photoIds[0])
      if (photo?.url) {
        try {
          const bytes = await renderImageToCanvasBytes({
            url: normalizeR2Url(photo.url),
            targetWPt: spreadWPt,
            targetHPt: pageHPt,
            placement: placements.get(photo.id) ?? DEFAULT_PLACEMENT,
            ptToPx,
          })
          const img = await pdfDoc.embedJpg(bytes)
          spreadPage.drawImage(img, { x: 0, y: 0, width: spreadWPt, height: pageHPt })
        } catch (err) {
          console.error('[PDF] Error en hero-spread:', err)
        }
      }
      i += 2
      continue
    }

    // Caso general: spread con 2 páginas distintas
    console.log(`[PDF] Spread ${spreadIdx} (${leftPage.layout}${rightPage ? ' + ' + rightPage.layout : ''})`)
    const spreadPage = pdfDoc.addPage([spreadWPt, pageHPt])

    await renderPageInArea(
      pdfDoc, spreadPage, leftPage, photosById, placements,
      0, 0, pageWPt, pageHPt,
      albumStyle, pageHPt, ptToPx
    )

    if (rightPage) {
      await renderPageInArea(
        pdfDoc, spreadPage, rightPage, photosById, placements,
        pageWPt, 0, pageWPt, pageHPt,
        albumStyle, pageHPt, ptToPx
      )
    }

    i += 2
  }

  // Contraportada en blanco
  pdfDoc.addPage([pageWPt, pageHPt])

  const bytes = await pdfDoc.save()
  console.log('[PDF] Generado, tamaño:', (bytes.length / 1024 / 1024).toFixed(1), 'MB')
  return bytes
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
