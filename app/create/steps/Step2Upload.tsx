"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  motion,
  AnimatePresence,
  Reorder,
  useMotionValue,
  useTransform,
} from "framer-motion";
import ContinueButton from "@/components/create/ContinueButton";
import { X, Star, Move } from "lucide-react";
import { useWizard, PhotoItem } from "@/components/create/WizardProvider";
import { usePhotoAnalysis } from "@/core/modules/scoring/usePhotoAnalysis";
import { getPhotoCacheEntry, updatePhotoCacheEntry, hasFullAnalysis, clearPixiaCache } from "@/core/modules/upload/photoCache";
import { useUpload } from "@/core/modules/upload/useUpload";
import { useSession } from "@/core/modules/session/useSession";
import { MIN_PHOTOS, MAX_PHOTOS } from "@/core/modules/upload/limits";

// Genera thumbnail 150x150 base64 (~8-12KB por foto) para grids rápidos
async function generateThumbnail(file: File, maxSize = 150): Promise<string | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new window.Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const ratio = img.width / img.height
        let w = maxSize, h = maxSize
        if (ratio > 1) h = Math.round(maxSize / ratio)
        else w = Math.round(maxSize * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.6))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('thumbnail gen failed'))
      }
      img.src = url
    })
  } catch {
    return null
  }
}

type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown'

async function detectImageFormat(file: File): Promise<ImageFormat> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer()
    const b = new Uint8Array(buffer)

    // JPEG: FF D8 FF
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg'
    // PNG: 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png'
    // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
    // HEIC/HEIF: bytes 4-7 = 'ftyp', bytes 8-11 = brand
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase()
      if (['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif'].some(t => brand.startsWith(t))) return 'heic'
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export default function Step2Upload() {
  const { state, dispatch } = useWizard();
  const photos = state.photos;
  const { progress, analyzePhotos } = usePhotoAnalysis();
  const { sessionId } = useSession();
  const { uploadProgress, uploadPhotos } = useUpload(sessionId || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [minPhotosError, setMinPhotosError] = useState<string | null>(null);
  const [heicWarning, setHeicWarning] = useState<string | null>(null);

  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      console.log('[Step2] onDrop recibió', acceptedFiles.length, 'archivos')
      setIsProcessing(true)

      try {
        // Detectar formato real por magic bytes antes de cualquier procesamiento
        const formats = await Promise.all(acceptedFiles.map(detectImageFormat))
        const validFiles = acceptedFiles.filter((_, i) => {
          const fmt = formats[i]
          return fmt === 'jpeg' || fmt === 'png' || fmt === 'webp'
        })
        const heicCount = formats.filter(f => f === 'heic').length
        const unknownCount = formats.filter(f => f === 'unknown').length
        const rejectedCount = heicCount + unknownCount

        if (rejectedCount > 0) {
          if (heicCount > 0) {
            setHeicWarning(
              `${heicCount} foto${heicCount > 1 ? 's' : ''} ` +
              `están en formato HEIC, que los navegadores no pueden procesar. ` +
              `Tip: si subes directo desde tu iPhone, se convierten automáticamente. ` +
              `Si las descargaste a tu computador, conviértelas a JPG primero.`
            )
          } else {
            setHeicWarning(
              `${unknownCount} foto${unknownCount > 1 ? 's' : ''} ` +
              `tienen un formato no soportado y fueron omitidas. ` +
              `Usa JPG, PNG o WebP.`
            )
          }
        } else {
          setHeicWarning(null)
        }

        if (validFiles.length === 0) return

        const newPhotos: PhotoItem[] = validFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          priority: false,
        }));

        // Mostrar thumbnails inmediatamente — no esperar análisis
        dispatch({
          type: "SET_PHOTOS",
          payload: [...photos, ...newPhotos].slice(0, MAX_PHOTOS),
        });

        // Separar files con análisis cacheado de los nuevos
        const cachedItems: Array<{
          file: File
          orientation: 'landscape' | 'portrait' | 'square'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          score: any
          takenAt: Date | null
          gps: { lat: number; lng: number } | null
          thumbnail?: string
          photoId: string
        }> = []
        const filesToAnalyze: File[] = []

        for (let idx = 0; idx < validFiles.length; idx++) {
          const file = validFiles[idx]
          const entry = getPhotoCacheEntry(file)
          if (hasFullAnalysis(entry)) {
            cachedItems.push({
              file,
              orientation: entry!.orientation!,
              score: entry!.score,
              takenAt: entry!.takenAt ? new Date(entry!.takenAt) : null,
              gps: entry!.gps || null,
              thumbnail: entry!.thumbnail,
              photoId: newPhotos[idx].id,
            })
          } else {
            filesToAnalyze.push(file)
          }
        }

        console.log(`[Step2] Cache: ${cachedItems.length} con análisis, ${filesToAnalyze.length} a analizar`)

        // Analizar solo los nuevos
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let newAnalysis: any[] = []
        if (filesToAnalyze.length > 0) {
          console.log('[Step2] Iniciando análisis de', filesToAnalyze.length, 'fotos nuevas...')
          newAnalysis = await analyzePhotos(filesToAnalyze)
          console.log('[Step2] Análisis completado:', newAnalysis.length, 'fotos')
        }

        // Combinar análisis cacheados + nuevos
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const analyzed: any[] = [
          ...cachedItems.map(c => ({
            id: c.photoId,
            file: c.file,
            orientation: c.orientation,
            score: c.score,
            exif: { takenAt: c.takenAt?.toISOString() ?? null, lat: c.gps?.lat, lng: c.gps?.lng },
          })),
          ...newAnalysis,
        ]

        // Thumbnails: cacheados primero, generar los faltantes
        console.log('[Step2] Generando thumbnails faltantes...')
        const thumbnails = await Promise.all(
          analyzed.map(async (item) => {
            const entry = getPhotoCacheEntry(item.file)
            if (entry?.thumbnail) return entry.thumbnail
            try {
              return await generateThumbnail(item.file)
            } catch {
              return null
            }
          })
        )
        console.log('[Step2] Thumbnails listos:', thumbnails.filter(Boolean).length)

        // Guardar TODO en cache (análisis + thumbnails) para la próxima vez
        for (let i = 0; i < analyzed.length; i++) {
          const item = analyzed[i]
          if (!item) continue
          updatePhotoCacheEntry(item.file, {
            orientation: item.orientation,
            score: item.score,
            takenAt: item.exif?.takenAt || null,
            gps: (item.exif?.lat != null && item.exif?.lng != null) ? { lat: item.exif.lat, lng: item.exif.lng } : null,
            thumbnail: thumbnails[i] || undefined,
          })
        }

        if (analyzed.length > 0) {
          localStorage.setItem(
            'pixia_photo_analysis',
            JSON.stringify(analyzed.map((p, index) => ({
              id: p.id,
              orientation: p.orientation,
              score: p.score,
              takenAt: p.exif.takenAt || null,
              gps: (p.exif.lat != null && p.exif.lng != null) ? { lat: p.exif.lat, lng: p.exif.lng } : null,
              originalIndex: index,
              thumbnail: thumbnails[index],
            })))
          );
          console.log('[Step2] Análisis guardado en localStorage')

          if (sessionId) {
            const filesToUpload = analyzed.map(p => ({
              file: p.file,
              photoId: p.id,
            }));
            const uploaded = await uploadPhotos(filesToUpload);
            if (uploaded.length > 0) {
              localStorage.setItem('pixia_r2_photos', JSON.stringify(uploaded));
              console.log('[Step2] Fotos subidas a R2:', uploaded.length);
            }
          }
        }
      } finally {
        setIsProcessing(false)
      }
    },
    [dispatch, photos, analyzePhotos, sessionId, uploadPhotos]
  );

  const removePhoto = (id: string) => {
    dispatch({
      type: "SET_PHOTOS",
      payload: photos.filter((p) => p.id !== id),
    });
  };

  const togglePriority = (id: string) => {
    const prioritized = photos.filter((p) => p.priority).length;

    dispatch({
      type: "SET_PHOTOS",
      payload: photos.map((p) => {
        if (p.id !== id) return p;
        if (!p.priority && prioritized >= 5) return p;
        return { ...p, priority: !p.priority };
      }),
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Tipos explícitos: en iOS, declarar JPEG hace que el sistema convierta HEIC automáticamente
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  });

  useEffect(() => {
    count.set(photos.length);
  }, [photos.length, count]);

  const unlocked = photos.length >= MIN_PHOTOS;
  const priorityCount = photos.filter((p) => p.priority).length;

  const handleContinue = () => {
    if (photos.length < MIN_PHOTOS) {
      setMinPhotosError(
        `Necesitas al menos ${MIN_PHOTOS} fotos para crear tu álbum. Llevas ${photos.length}.`
      )
      return
    }
    setMinPhotosError(null)
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">
          Sube y ordena tus recuerdos
        </h1>
        <p className="text-white/60 mt-3 max-w-xl mx-auto">
          Arrastra las fotos para definir el orden de tu historia. Marca las más
          importantes.
        </p>
      </div>

      <motion.div
        {...(getRootProps() as any)}
        whileHover={{ scale: 1.01 }}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
          ${
            isDragActive
              ? "border-pink-400 bg-pink-500/10 shadow-[0_0_40px_rgba(236,72,153,0.4)]"
              : "border-white/20 bg-white/5 hover:border-white/40"
          }`}
      >
        <input {...getInputProps()} />

        <div className="relative z-10 flex flex-col items-center gap-3">
          <span className="text-4xl">📸</span>
          <p className="text-white font-medium">
            Arrastra tus fotos aquí o haz clic para subir
          </p>

          <motion.p className="text-white/50 text-sm">
            <motion.span>{rounded}</motion.span> / {MAX_PHOTOS} fotos (mínimo {MIN_PHOTOS})
          </motion.p>

          {priorityCount > 0 && (
            <p className="text-xs text-pink-400">
              ⭐ {priorityCount} foto{priorityCount > 1 ? "s" : ""} priorizada
              {priorityCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </motion.div>

      {process.env.NODE_ENV === 'development' && (
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button
            type="button"
            onClick={clearPixiaCache}
            style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          >
            🧹 Limpiar caché (dev)
          </button>
        </div>
      )}

      {heicWarning && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 8,
          fontSize: 13,
          color: '#fbbf24',
          lineHeight: 1.6,
        }}>
          {heicWarning}
        </div>
      )}

      {progress.isAnalyzing && (
        <div style={{
          padding: '12px 16px', marginTop: '16px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '12px', color: 'rgba(255,255,255,0.5)',
          }}>
            <span>Analizando fotos...</span>
            <span>{progress.completed} / {progress.total}</span>
          </div>
          <div style={{
            height: '2px', background: 'rgba(255,255,255,0.08)',
            borderRadius: '1px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', background: '#E8553A',
              width: `${(progress.completed / progress.total) * 100}%`,
              transition: 'width 0.3s ease', borderRadius: '1px',
            }} />
          </div>
          {progress.insights.length > 0 && (
            <span style={{
              fontSize: '11px', color: 'rgba(232,85,58,0.8)', fontStyle: 'italic',
            }}>
              {progress.insights[progress.insights.length - 1]}
            </span>
          )}
        </div>
      )}

      {uploadProgress.isUploading && (
        <div style={{
          padding: '12px 16px', marginTop: '8px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '12px', color: 'rgba(255,255,255,0.5)',
          }}>
            <span>Guardando en la nube...</span>
            <span>{uploadProgress.completed} / {uploadProgress.total}</span>
          </div>
          <div style={{
            height: '2px', background: 'rgba(255,255,255,0.08)',
            borderRadius: '1px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', background: '#E8553A',
              width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`,
              transition: 'width 0.3s ease', borderRadius: '1px',
            }} />
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <Reorder.Group
          axis="x"
          values={photos}
          onReorder={(newOrder) =>
            dispatch({ type: "SET_PHOTOS", payload: newOrder })
          }
          className="grid grid-cols-3 md:grid-cols-5 gap-4 mt-8"
        >
          <AnimatePresence>
            {photos.map((item) => (
              <Reorder.Item
                key={item.id}
                value={item}
                whileDrag={{ scale: 1.1, zIndex: 50 }}
                className={`relative group w-full h-24 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing
                  ${
                    item.priority
                      ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.6)]"
                      : ""
                  }`}
              >
                <img
                  src={URL.createObjectURL(item.file)}
                  alt="preview"
                  className="object-cover w-full h-full"
                />

                <div className="absolute top-1.5 left-1.5 text-white/60 opacity-0 group-hover:opacity-100 transition">
                  <Move className="w-4 h-4" />
                </div>

                <button
                  onClick={() => removePhoto(item.id)}
                  className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full
                    bg-black/60 backdrop-blur text-white/80
                    flex items-center justify-center
                    opacity-100 md:opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => togglePriority(item.id)}
                  className={`absolute bottom-1.5 right-1.5 z-10 w-6 h-6 rounded-full
                    backdrop-blur flex items-center justify-center transition
                    ${
                      item.priority
                        ? "bg-pink-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.9)]"
                        : "bg-black/50 text-white/70 opacity-0 group-hover:opacity-100"
                    }`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      item.priority ? "fill-white" : ""
                    }`}
                  />
                </button>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {minPhotosError && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          background: 'rgba(255,60,60,0.1)',
          border: '1px solid rgba(255,60,60,0.25)',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#ff8080',
          textAlign: 'center',
        }}>
          {minPhotosError}
        </div>
      )}

      <div onClick={handleContinue}>
        <ContinueButton disabled={isProcessing || !unlocked} />
      </div>
    </div>
  );
}
