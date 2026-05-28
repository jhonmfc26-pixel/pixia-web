export interface PhotoScore {
  sharpness: number
  exposure: number
  composition: number
  faces: number
  resolution: number
  finalScore: number
  recommendation: 'hero' | 'supporting' | 'discard'
}

export async function scorePhoto(src: string): Promise<PhotoScore> {
  if (typeof window === 'undefined') return defaultScore()
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX = 200
      const scale = Math.min(MAX / img.width, MAX / img.height)
      canvas.width = Math.floor(img.width * scale)
      canvas.height = Math.floor(img.height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(defaultScore()); return }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data

      const sharpness = measureSharpness(pixels, canvas.width, canvas.height)
      const exposure = measureExposure(pixels)
      const composition = measureComposition(pixels, canvas.width, canvas.height)
      const resolution = measureResolution(img.width, img.height)
      const faces = 0

      const finalScore = Math.round(sharpness + exposure + composition + faces + resolution)

      const recommendation: 'hero' | 'supporting' | 'discard' =
        finalScore >= 70 ? 'hero' :
        finalScore >= 45 ? 'supporting' : 'discard'

      resolve({ sharpness, exposure, composition, faces, resolution, finalScore, recommendation })
    }
    img.onerror = () => resolve(defaultScore())
    img.src = src
  })
}

function defaultScore(): PhotoScore {
  return {
    sharpness: 12, exposure: 10, composition: 10,
    faces: 0, resolution: 10, finalScore: 42,
    recommendation: 'supporting',
  }
}

function measureSharpness(pixels: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0, count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      const gray   = (pixels[i]   + pixels[i+1]   + pixels[i+2])   / 3
      const top    = (pixels[((y-1)*w+x)*4] + pixels[((y-1)*w+x)*4+1] + pixels[((y-1)*w+x)*4+2]) / 3
      const bottom = (pixels[((y+1)*w+x)*4] + pixels[((y+1)*w+x)*4+1] + pixels[((y+1)*w+x)*4+2]) / 3
      const left   = (pixels[(y*w+x-1)*4]   + pixels[(y*w+x-1)*4+1]   + pixels[(y*w+x-1)*4+2])   / 3
      const right  = (pixels[(y*w+x+1)*4]   + pixels[(y*w+x+1)*4+1]   + pixels[(y*w+x+1)*4+2])   / 3
      sum += Math.abs(4 * gray - top - bottom - left - right)
      count++
    }
  }
  return Math.min(25, Math.round((sum / count / 20) * 25))
}

function measureExposure(pixels: Uint8ClampedArray): number {
  let total = 0
  const count = pixels.length / 4
  for (let i = 0; i < pixels.length; i += 4) {
    total += pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114
  }
  const avg = total / count
  if (avg >= 80 && avg <= 180) return 20
  if (avg >= 60 && avg <= 200) return 15
  if (avg >= 40 && avg <= 220) return 10
  return 5
}

function measureComposition(pixels: Uint8ClampedArray, w: number, h: number): number {
  const cx = Math.floor(w / 3)
  const cy = Math.floor(h / 3)
  let cBright = 0, bBright = 0, cCount = 0, bCount = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const b = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3
      if (x >= cx && x < w - cx && y >= cy && y < h - cy) {
        cBright += b; cCount++
      } else {
        bBright += b; bCount++
      }
    }
  }

  const contrast = Math.abs(cBright / cCount - bBright / bCount)
  return Math.min(20, Math.round((contrast / 50) * 20))
}

function measureResolution(w: number, h: number): number {
  const pixels = w * h
  if (pixels >= 12000000) return 15
  if (pixels >= 8000000) return 12
  if (pixels >= 4000000) return 10
  if (pixels >= 2000000) return 7
  return 4
}
