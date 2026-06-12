/**
 * Comprime una imagen para upload preservando calidad de impresión.
 *
 * Target: imprimir 30×30 cm a ~250 dpi → ~3000px de lado mayor es suficiente.
 * Las fotos de iPhone (4032×3024) tienen sobra de resolución.
 *
 * Reducción típica: 5-10 MB → 1-2 MB (5x menos transferencia).
 */
export interface CompressedUpload {
  blob: Blob
  sizeBefore: number
  sizeAfter: number
  savedRatio: number
  width: number
  height: number
}

const MAX_DIMENSION = 3000  // px - suficiente para 30×30 cm a 250 dpi
const QUALITY = 0.85        // JPEG quality - visualmente idéntico al original

export async function compressForUpload(file: File): Promise<CompressedUpload> {
  if (typeof window === 'undefined') {
    throw new Error('compressForUpload solo funciona en el browser')
  }

  // Si el archivo ya es chico (<1.5MB), saltarse compresión
  if (file.size < 1.5 * 1024 * 1024) {
    return {
      blob: file,
      sizeBefore: file.size,
      sizeAfter: file.size,
      savedRatio: 0,
      width: 0,
      height: 0,
    }
  }

  return new Promise<CompressedUpload>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()

    img.onload = () => {
      try {
        let { width, height } = img

        // Reducir si el lado mayor excede MAX_DIMENSION
        if (width > height && width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width)
          width = MAX_DIMENSION
        } else if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height)
          height = MAX_DIMENSION
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('No se pudo crear canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            if (!blob) {
              reject(new Error('canvas.toBlob retornó null'))
              return
            }
            resolve({
              blob,
              sizeBefore: file.size,
              sizeAfter: blob.size,
              savedRatio: 1 - blob.size / file.size,
              width,
              height,
            })
          },
          'image/jpeg',
          QUALITY
        )
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo cargar la imagen'))
    }

    img.src = url
  })
}
