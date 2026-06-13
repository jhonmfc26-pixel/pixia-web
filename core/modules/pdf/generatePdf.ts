'use client'

import { PDFDocument } from 'pdf-lib'
import type { AlbumBlueprint, PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, PhotoPlacement, Page } from '@/core/modules/album/types'
import { DEFAULT_PLACEMENT } from '@/core/modules/album/types'
import { buildPages, extractPhotoPool } from '@/core/modules/album/pageEngine'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import { computeObjectPosition } from '@/core/modules/album/smartCrop'
import type { LayoutSchema } from '@/core/modules/album/layouts/types'
import { getFormatById } from '@/core/modules/album/formats/registry'
import { cmToPt, ptToPxFactor } from '@/core/modules/album/formats/units'
import { getTemplateById } from '@/core/modules/cover/coverTemplates'
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import type { CoverTemplate } from '@/core/modules/cover/coverTemplates'

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

// ============ HELPERS PARA COVER ============

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.crossOrigin = 'anonymous'   // debe ir ANTES de img.src
  // ?pdf=1 evita que el navegador reutilice una respuesta cacheada sin cabeceras CORS
  const src = url.startsWith('/') ? url : (url.includes('?') ? `${url}&pdf=1` : `${url}?pdf=1`)
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`No se pudo cargar: ${url}`))
    img.src = src
  })
  return img
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destX: number, destY: number,
  destW: number, destH: number
): void {
  const imgRatio = img.width / img.height
  const destRatio = destW / destH
  let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height
  if (imgRatio > destRatio) {
    srcW = img.height * destRatio
    srcX = (img.width - srcW) / 2
  } else {
    srcH = img.width / destRatio
    srcY = (img.height - srcH) / 2
  }
  ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, destW, destH)
}

async function ensureCoverFontsLoaded(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('400 32px "Playfair Display"'),
      document.fonts.load('500 32px "Playfair Display"'),
      document.fonts.load('600 32px "Playfair Display"'),
      document.fonts.load('700 32px "Playfair Display"'),
      document.fonts.load('300 13px Inter'),
      document.fonts.load('400 13px Inter'),
      document.fonts.load('700 13px Inter'),
    ])
    await document.fonts.ready
  } catch (err) {
    console.warn('[PDF] Fuentes no se cargaron completamente:', err)
  }
}

function drawTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' | 'right' = 'center'
): void {
  const letters = text.split('')
  const widths = letters.map(l => ctx.measureText(l).width)
  const totalWidth = widths.reduce((a, w) => a + w, 0) + spacing * (letters.length - 1)
  let startX: number
  if (align === 'center') startX = centerX - totalWidth / 2
  else if (align === 'right') startX = centerX - totalWidth
  else startX = centerX
  const prevAlign = ctx.textAlign
  ctx.textAlign = 'left'
  let cursor = startX
  letters.forEach((l, i) => {
    ctx.fillText(l, cursor, y)
    cursor += widths[i] + spacing
  })
  ctx.textAlign = prevAlign
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  style: CoverTemplate['overlayStyle'],
  w: number,
  h: number
): void {
  if (style === 'none') return
  if (style === 'gradient-bottom') {
    const grad = ctx.createLinearGradient(0, h, 0, 0)
    grad.addColorStop(0, 'rgba(0,0,0,0.7)')
    grad.addColorStop(0.45, 'rgba(0,0,0,0.1)')
    grad.addColorStop(0.7, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  } else if (style === 'gradient-full') {
    const grad = ctx.createLinearGradient(0, h, 0, 0)
    grad.addColorStop(0, 'rgba(0,0,0,0.6)')
    grad.addColorStop(1, 'rgba(0,0,0,0.2)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  } else if (style === 'dark-vignette') {
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.3,
      w / 2, h / 2, Math.max(w, h) * 0.7
    )
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.5)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.95): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('Canvas toBlob falló'))
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)))
    }, 'image/jpeg', quality)
  })
}

function drawCoverText(
  ctx: CanvasRenderingContext2D,
  config: CoverConfig,
  template: CoverTemplate,
  canvasW: number,
  canvasH: number
): void {
  const REFERENCE_W = 500
  const scale = canvasW / REFERENCE_W
  const textColor = config.textColor === 'dark' ? '#1a1a1a' : '#FFFFFF'
  const padX = 24 * scale
  const padY = 28 * scale

  const titleSize = template.titleSize * scale
  const subtitleSize = template.subtitleSize * scale
  const dateSize = (template.subtitleSize - 1) * scale

  const lineHeightTitle = titleSize * 1.1
  const dividerHeight = template.showDivider && config.subtitle ? 10 * scale + 1 + 10 * scale : 0
  const subtitleHeight = config.subtitle ? 6 * scale + subtitleSize * 1.2 : 0
  const dateHeight = config.date ? 4 * scale + dateSize * 1.2 : 0
  const totalTextHeight = lineHeightTitle + dividerHeight + subtitleHeight + dateHeight

  let blockStartY: number
  if (config.textPosition === 'top') blockStartY = padY
  else if (config.textPosition === 'center') blockStartY = (canvasH - totalTextHeight) / 2
  else blockStartY = canvasH - padY - totalTextHeight

  let textX: number
  let canvasAlign: 'left' | 'center' | 'right'
  if (config.textAlign === 'left') { textX = padX; canvasAlign = 'left' }
  else if (config.textAlign === 'right') { textX = canvasW - padX; canvasAlign = 'right' }
  else { textX = canvasW / 2; canvasAlign = 'center' }

  const shadowColor = textColor === '#FFFFFF' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)'
  ctx.shadowColor = shadowColor
  ctx.shadowBlur = 12 * scale
  ctx.shadowOffsetY = 2 * scale

  ctx.fillStyle = textColor
  ctx.textAlign = canvasAlign
  ctx.textBaseline = 'top'
  ctx.font = `${template.titleWeight} ${titleSize}px "${template.titleFont}", serif`

  const titleLetterSpacingPx = parseFloat(template.letterSpacing) * titleSize
  drawTextWithLetterSpacing(ctx, config.title, textX, blockStartY, titleLetterSpacingPx, canvasAlign)

  let cursorY = blockStartY + lineHeightTitle

  if (template.showDivider && config.subtitle) {
    cursorY += 10 * scale
    const dividerW = 40 * scale
    let dividerX: number
    if (canvasAlign === 'left') dividerX = textX
    else if (canvasAlign === 'right') dividerX = textX - dividerW
    else dividerX = textX - dividerW / 2
    const prevShadow = ctx.shadowColor
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = 0.5
    ctx.fillRect(dividerX, cursorY, dividerW, 1)
    ctx.globalAlpha = 1
    ctx.shadowColor = prevShadow
    cursorY += 1 + 10 * scale
  }

  if (config.subtitle) {
    cursorY += 6 * scale
    ctx.globalAlpha = 0.85
    ctx.font = `300 ${subtitleSize}px Inter, sans-serif`
    drawTextWithLetterSpacing(ctx, config.subtitle, textX, cursorY, 0.05 * subtitleSize, canvasAlign)
    ctx.globalAlpha = 1
    cursorY += subtitleSize * 1.2
  }

  if (config.date) {
    cursorY += 4 * scale
    ctx.globalAlpha = 0.6
    ctx.font = `400 ${dateSize}px Inter, sans-serif`
    drawTextWithLetterSpacing(ctx, config.date.toUpperCase(), textX, cursorY, 0.12 * dateSize, canvasAlign)
    ctx.globalAlpha = 1
  }

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
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
  img.crossOrigin = 'anonymous'   // debe ir ANTES de img.src
  const pdfUrl = url.includes('?') ? `${url}&pdf=1` : `${url}?pdf=1`
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`No se pudo cargar: ${url}`))
    img.src = pdfUrl
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
): Promise<{ attempted: number; failed: number }> {
  const layout = getLayoutById(page.layout)
  if (!layout) {
    console.warn('[PDF] Layout no encontrado:', page.layout)
    return { attempted: 0, failed: 0 }
  }

  const gap = albumStyle === 'con-margen' ? GAP_CON_MARGEN_PT : GAP_SIN_MARGEN_PT
  const outerMargin = albumStyle === 'con-margen' ? MARGIN_CON_MARGEN_PT : 0

  const photoIds = page.photoIds || []
  let attempted = 0
  let failed = 0

  for (let i = 0; i < layout.slots.length && i < photoIds.length; i++) {
    const slot = layout.slots[i]
    const photoId = photoIds[i]
    const photo = photosById.get(photoId)
    if (!photo?.url) continue

    attempted++

    const rect = getSlotCssRect(slot, layout, areaW, areaH, gap, outerMargin)
    if (!rect) continue

    const slotCfg = layout.slotConfig?.[i]
    const effectivePlacement = slotCfg?.disablePlacement
      ? DEFAULT_PLACEMENT
      : (placements.get(photo.id) ?? DEFAULT_PLACEMENT)

    // Smart crop: igual que el viewer — mismo cálculo, cero reimplementación
    const isDefault = effectivePlacement.offsetX === 0 && effectivePlacement.offsetY === 0 && effectivePlacement.zoom === 1
    let resolvedObjectPosition = slotCfg?.objectPosition
    if (!resolvedObjectPosition && isDefault && photo.meaningRegions?.length) {
      const photoAspect = (photo.width && photo.height) ? photo.width / photo.height
        : (photo.orientation === 'portrait' ? 3 / 4 : 4 / 3)
      const { x, y } = computeObjectPosition(photoAspect, rect.w / rect.h, photo.meaningRegions.map(r => r.rect), photo.id)
      resolvedObjectPosition = `${x}% ${y}%`
    }

    try {
      const bytes = await renderImageToCanvasBytes({
        url: normalizeR2Url(photo.url),
        targetWPt: rect.w,
        targetHPt: rect.h,
        placement: effectivePlacement,
        ptToPx,
        objectPositionOverride: resolvedObjectPosition,
      })
      const img = await pdfDoc.embedJpg(bytes)

      const finalX = areaX + rect.x
      const finalYCss = areaY + rect.y
      const finalY = pdfPageH - finalYCss - rect.h

      pdfPage.drawImage(img, { x: finalX, y: finalY, width: rect.w, height: rect.h })
    } catch (err) {
      console.error(`[PDF] Error en slot ${slot} (page ${page.id}):`, err)
      failed++
    }
  }

  return { attempted, failed }
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

  const cover = (book as unknown as { cover?: CoverConfig }).cover
  if (!cover) { console.warn('[PDF] No hay cover config'); return }

  await ensureCoverFontsLoaded()

  const canvasW = Math.round(pageWPt * ptToPx)
  const canvasH = Math.round(pageHPt * ptToPx)
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) { console.error('[PDF] No se pudo crear canvas context'); return }

  // 1. Background base
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // 2. Foto de fondo en modo cover
  if (cover.photoId) {
    const coverPhoto = photosById.get(cover.photoId)
    if (coverPhoto?.url) {
      try {
        const img = await loadImage(normalizeR2Url(coverPhoto.url))
        drawImageCover(ctx, img, 0, 0, canvasW, canvasH)
      } catch (err) {
        console.error('[PDF] No se pudo cargar foto de portada:', err)
      }
    }
  }

  // 3. Overlay + textos según template
  const template = getTemplateById(cover.templateId)
  if (template) {
    drawOverlay(ctx, template.overlayStyle, canvasW, canvasH)
    drawCoverText(ctx, cover, template, canvasW, canvasH)
  } else {
    console.warn('[PDF] Template no encontrado:', cover.templateId)
  }

  // 4. Exportar → JPEG → embeber
  try {
    const bytes = await canvasToJpegBytes(canvas, 0.95)
    const img = await pdfDoc.embedJpg(bytes)
    pdfPage.drawImage(img, { x: 0, y: 0, width: pageWPt, height: pageHPt })
  } catch (err) {
    console.error('[PDF] Error embebiendo portada:', err)
  }
}

async function renderBackCoverPdf(
  pdfDoc: PDFDocument,
  pageWPt: number,
  pageHPt: number,
  ptToPx: number
): Promise<void> {
  const pdfPage = pdfDoc.addPage([pageWPt, pageHPt])

  const canvasW = Math.round(pageWPt * ptToPx)
  const canvasH = Math.round(pageHPt * ptToPx)
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 1. Background
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // 2. Logo Pixia centrado
  const logoSize = canvasW * 0.064
  const logoX = (canvasW - logoSize) / 2
  const logoY = canvasH / 2 - logoSize / 2 - logoSize * 0.4

  try {
    const logo = await loadImage('/logo-pixia.png')
    ctx.globalAlpha = 0.5
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
    ctx.globalAlpha = 1
  } catch {
    console.warn('[PDF] Logo Pixia no encontrado — contraportada sin logo')
  }

  // 3. Texto "PIXIA"
  await ensureCoverFontsLoaded()
  const textSize = canvasW * 0.022
  const textY = logoY + logoSize + canvasW * 0.025

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = `400 ${textSize}px Inter, system-ui, sans-serif`
  ctx.textBaseline = 'top'
  drawTextWithLetterSpacing(ctx, 'PIXIA', canvasW / 2, textY, 0.3 * textSize, 'center')

  // 4. Exportar → JPEG → embeber
  try {
    const bytes = await canvasToJpegBytes(canvas, 0.92)
    const img = await pdfDoc.embedJpg(bytes)
    pdfPage.drawImage(img, { x: 0, y: 0, width: pageWPt, height: pageHPt })
  } catch (err) {
    console.error('[PDF] Error embebiendo contraportada:', err)
  }
}

// ============ MAIN ============

export async function generatePdfFromBook(opts: GeneratePdfOptions): Promise<{ bytes: Uint8Array; failedPhotos: number }> {
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

  let totalPhotos = 0
  let failedPhotos = 0
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
        totalPhotos++
        try {
          const heroPlacement = placements.get(photo.id) ?? DEFAULT_PLACEMENT
          const heroIsDefault = heroPlacement.offsetX === 0 && heroPlacement.offsetY === 0 && heroPlacement.zoom === 1
          let heroObjectPosition: string | undefined
          if (heroIsDefault && photo.meaningRegions?.length) {
            const photoAspect = (photo.width && photo.height) ? photo.width / photo.height : 4 / 3
            const { x, y } = computeObjectPosition(photoAspect, spreadWPt / pageHPt, photo.meaningRegions.map(r => r.rect), photo.id)
            heroObjectPosition = `${x}% ${y}%`
          }
          const imgBytes = await renderImageToCanvasBytes({
            url: normalizeR2Url(photo.url),
            targetWPt: spreadWPt,
            targetHPt: pageHPt,
            placement: heroPlacement,
            ptToPx,
            objectPositionOverride: heroObjectPosition,
          })
          const img = await pdfDoc.embedJpg(imgBytes)
          spreadPage.drawImage(img, { x: 0, y: 0, width: spreadWPt, height: pageHPt })
        } catch (err) {
          console.error('[PDF] Error en hero-spread:', err)
          failedPhotos++
        }
      }
      i += 2
      continue
    }

    // Caso general: spread con 2 páginas distintas
    console.log(`[PDF] Spread ${spreadIdx} (${leftPage.layout}${rightPage ? ' + ' + rightPage.layout : ''})`)
    const spreadPage = pdfDoc.addPage([spreadWPt, pageHPt])

    const leftResult = await renderPageInArea(
      pdfDoc, spreadPage, leftPage, photosById, placements,
      0, 0, pageWPt, pageHPt,
      albumStyle, pageHPt, ptToPx
    )
    totalPhotos += leftResult.attempted
    failedPhotos += leftResult.failed

    if (rightPage) {
      const rightResult = await renderPageInArea(
        pdfDoc, spreadPage, rightPage, photosById, placements,
        pageWPt, 0, pageWPt, pageHPt,
        albumStyle, pageHPt, ptToPx
      )
      totalPhotos += rightResult.attempted
      failedPhotos += rightResult.failed
    }

    i += 2
  }

  await renderBackCoverPdf(pdfDoc, pageWPt, pageHPt, ptToPx)

  const bytes = await pdfDoc.save()
  console.log(`[PDF] ${spreadIdx} spreads, ${totalPhotos} fotos, ${failedPhotos} fallidas — ${(bytes.length / 1024 / 1024).toFixed(1)} MB`)
  return { bytes, failedPhotos }
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
