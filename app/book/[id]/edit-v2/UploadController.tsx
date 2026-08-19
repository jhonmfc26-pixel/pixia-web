'use client'

import { forwardRef, useImperativeHandle } from 'react'
import type { AlbumBlueprint, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { LayoutId } from '@/core/modules/album/layouts/registry'
import { normalizeFiles } from '@/core/modules/upload/normalizeFiles'
import { usePhotoAnalysis } from '@/core/modules/scoring/usePhotoAnalysis'
import { useUpload } from '@/core/modules/upload/useUpload'

// Mismo chequeo de magic bytes que Step2Upload — el pipeline solo acepta
// jpeg/png/webp reales, sin confiar en la extensión del archivo.
type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown'

async function detectImageFormat(file: File): Promise<ImageFormat> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer()
    const b = new Uint8Array(buffer)
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg'
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png'
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase()
      if (['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif'].some(t => brand.startsWith(t))) return 'heic'
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export interface UploadControllerHandle {
  processOneFile: (file: File, contentHash: string) => Promise<PhotoAsset | null>
}

interface UploadControllerProps {
  sessionId: string | null
  setBook: (updater: (prev: AlbumBlueprint | null) => AlbumBlueprint | null) => void
  showToast: (msg: string, isError?: boolean, durationMs?: number) => void
}

/**
 * Todo el pipeline de "subir foto nueva" (normalizeFiles → heic2any/exifr,
 * análisis, subida a R2) vive acá adentro y en NINGÚN OTRO LADO — este
 * componente se monta vía next/dynamic(..., { ssr: false }) desde page.tsx,
 * que es lo único que de verdad excluye su grafo de imports del bundle del
 * edge function (edit-v2 es runtime='edge'). Un import() suelto dentro de
 * una función NO alcanza acá: Cloudflare Workers no soporta cargar chunks
 * aparte en runtime, así que next-on-pages horneja cualquier módulo
 * alcanzable — estática o dinámicamente — dentro del mismo .func.js. Solo el
 * límite ssr:false de Next (que directamente omite el componente del render
 * de servidor) logra que heic2any/exifr no lleguen ni sean necesarios ahí.
 * No renderiza UI propia — el <input type="file"> y los botones siguen en
 * page.tsx; este componente solo expone processOneFile vía ref.
 */
const UploadController = forwardRef<UploadControllerHandle, UploadControllerProps>(
  function UploadController({ sessionId, setBook, showToast }, ref) {
    const { analyzePhotos } = usePhotoAnalysis()
    const { uploadPhotos } = useUpload(sessionId || '')

    useImperativeHandle(ref, () => ({
      processOneFile: async (file: File, contentHash: string): Promise<PhotoAsset | null> => {
        try {
          const { files: normalized, failed } = await normalizeFiles([file])
          if (failed.length > 0 || normalized.length === 0) {
            showToast('No pudimos procesar esa foto', true, 4000)
            return null
          }
          const { file: normFile, heicExif } = normalized[0]

          const fmt = await detectImageFormat(normFile)
          if (fmt !== 'jpeg' && fmt !== 'png' && fmt !== 'webp') {
            showToast('Formato no soportado — usa JPG, PNG, WebP o HEIC', true, 4000)
            return null
          }

          if (!sessionId) {
            showToast('Sesión no disponible, reintenta', true, 4000)
            return null
          }

          const [analyzed] = await analyzePhotos([normFile])
          if (!analyzed) {
            showToast('No pudimos analizar esa foto', true, 4000)
            return null
          }

          const photoId = analyzed.id
          const uploaded = await uploadPhotos([{ file: normFile, photoId }])
          if (uploaded.length === 0) {
            showToast('No se pudo subir la foto, reintenta', true, 4000)
            return null
          }
          const up = uploaded[0]

          // La conversión HEIC→JPEG descarta el EXIF — usar el extraído del original.
          const takenAt = heicExif?.takenAt ?? analyzed.exif.takenAt ?? null
          const gps =
            heicExif?.lat != null && heicExif?.lng != null
              ? { lat: heicExif.lat, lng: heicExif.lng }
              : analyzed.exif.lat != null && analyzed.exif.lng != null
                ? { lat: analyzed.exif.lat, lng: analyzed.exif.lng }
                : undefined

          const newPhoto: PhotoAsset = {
            id: photoId,
            r2Key: up.r2Key,
            url: up.url,
            thumbnailUrl: up.thumbnailUrl,
            width: analyzed.width,
            height: analyzed.height,
            orientation: analyzed.orientation,
            // PhotoScore de usePhotoAnalysis no trae uniqueness/emotionalWeight —
            // mismo default que normalizeBook.ts aplica en el resto del álbum.
            score: { ...analyzed.score, uniqueness: 100, emotionalWeight: 50 },
            takenAt,
            gps,
            originalName: file.name,
            meaningRegions: analyzed.meaningRegions,
            contentHash,
          }

          setBook(prev => {
            if (!prev) return prev
            const newSpread = {
              id: `spread-upload-${photoId}`,
              act: 'desarrollo' as const,
              layout: 'single' as LayoutId,
              photos: [newPhoto],
              isLocked: false,
              pageNumber: prev.spreads.length,
            }
            return { ...prev, spreads: [...prev.spreads, newSpread] }
          })

          return newPhoto
        } catch (e) {
          console.error('[EditV2] Error subiendo foto:', e)
          showToast('No se pudo subir la foto, reintenta', true, 4000)
          return null
        }
      },
    }))

    return null
  }
)

export default UploadController
