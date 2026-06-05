'use client'

import { PDFDocument } from 'pdf-lib'
import type { AlbumBlueprint, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, PhotoPlacement } from '@/core/modules/album/types'
import { buildPages, extractPhotoPool } from '@/core/modules/album/pageEngine'

/**
 * Migra URLs antiguas del dominio público r2.dev al custom domain.
 * Compatible con álbumes guardados en localStorage antes del custom domain.
 */
function normalizeR2Url(url: string): string {
  if (!url) return url
  if (url.includes('assets.pixiaa.com')) return url
  const r2DevMatch = url.match(/^https?:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/)
  if (r2DevMatch) {
    return `https://assets.pixiaa.com/${r2DevMatch[1]}`
  }
  return url
}

interface GeneratePdfOptions {
  book: AlbumBlueprint
  photosById: Map<string, PhotoAsset>
  layoutConfig: LayoutConfig
  placements: Map<string, PhotoPlacement>
}

// Tamaño físico final: 30x30 cm a 300 DPI
// 30 cm = 300 mm = 11.81 pulgadas
// 11.81 * 300 DPI = 3543 pixeles
// pdf-lib trabaja en puntos: 1 pulgada = 72 puntos
// 30 cm = 11.81 pulgadas = 850.39 puntos
const PAGE_SIZE_PT = 850.39

/**
 * Genera un PDF del álbum.
 * Versión inicial: solo layout 'full' (1 foto por página).
 * Layouts complejos en E#1.2.
 */
export async function generatePdfFromBook(opts: GeneratePdfOptions): Promise<Uint8Array> {
  const { book, photosById, layoutConfig } = opts

  const manualOrder = (book as unknown as { manualPhotoOrder?: string[] }).manualPhotoOrder
  const photoPool = extractPhotoPool(book.spreads, manualOrder)
  const { pages } = buildPages(photoPool, layoutConfig)

  console.log('[PDF] Generando con', pages.length, 'páginas')

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(book.cover?.title || 'Mi álbum')
  pdfDoc.setCreator('Pixia')
  pdfDoc.setProducer('Pixia v1.0')

  // PASO 1 — Portada
  if (book.cover?.photoId) {
    const coverPhoto = photosById.get(book.cover.photoId)
    if (coverPhoto?.url) {
      const page = pdfDoc.addPage([PAGE_SIZE_PT, PAGE_SIZE_PT])
      try {
        const imgBytes = await fetch(normalizeR2Url(coverPhoto.url)).then(r => r.arrayBuffer())
        const img = await embedImage(pdfDoc, new Uint8Array(imgBytes), coverPhoto.url)
        if (img) {
          page.drawImage(img, { x: 0, y: 0, width: PAGE_SIZE_PT, height: PAGE_SIZE_PT })
        }
      } catch (err) {
        console.error('[PDF] Error en portada:', err)
      }
    }
  }

  // PASO 2 — Páginas internas (layout full — 1 foto por página)
  for (let i = 0; i < pages.length; i++) {
    const pageData = pages[i]
    const page = pdfDoc.addPage([PAGE_SIZE_PT, PAGE_SIZE_PT])

    const firstPhotoId = pageData.photoIds?.[0]
    if (!firstPhotoId) continue

    const photo = photosById.get(firstPhotoId)
    if (!photo?.url) continue

    try {
      const imgBytes = await fetch(normalizeR2Url(photo.url)).then(r => r.arrayBuffer())
      const img = await embedImage(pdfDoc, new Uint8Array(imgBytes), photo.url)
      if (!img) continue

      // Cover fit: llena la página manteniendo el aspect ratio
      const imgRatio = img.width / img.height
      let drawW = PAGE_SIZE_PT
      let drawH = PAGE_SIZE_PT
      let drawX = 0
      let drawY = 0

      if (imgRatio > 1) {
        drawH = PAGE_SIZE_PT
        drawW = drawH * imgRatio
        drawX = (PAGE_SIZE_PT - drawW) / 2
      } else {
        drawW = PAGE_SIZE_PT
        drawH = drawW / imgRatio
        drawY = (PAGE_SIZE_PT - drawH) / 2
      }

      page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH })
    } catch (err) {
      console.error(`[PDF] Error en página ${i}:`, err)
    }
  }

  // Contraportada vacía
  pdfDoc.addPage([PAGE_SIZE_PT, PAGE_SIZE_PT])

  const bytes = await pdfDoc.save()
  console.log('[PDF] Generado, tamaño:', (bytes.length / 1024 / 1024).toFixed(1), 'MB')
  return bytes
}

async function embedImage(pdfDoc: PDFDocument, bytes: Uint8Array, url: string) {
  try {
    if (url.toLowerCase().endsWith('.png')) {
      return await pdfDoc.embedPng(bytes)
    }
    return await pdfDoc.embedJpg(bytes)
  } catch (err) {
    console.error('[PDF] No se pudo embeber imagen:', url, err)
    return null
  }
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
