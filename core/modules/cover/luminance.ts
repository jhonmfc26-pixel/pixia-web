export async function detectTextColor(
  imageSrc: string,
  position: 'top' | 'center' | 'bottom'
): Promise<'light' | 'dark'> {
  if (typeof window === 'undefined') return 'light'

  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve('light'); return }

      const srcY = position === 'top' ? 0
        : position === 'center' ? img.height / 3
        : img.height * 0.66
      const srcH = img.height / 3

      ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, 100, 100)

      const data = ctx.getImageData(0, 0, 100, 100).data
      let totalLum = 0
      const count = data.length / 4

      for (let i = 0; i < data.length; i += 4) {
        totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }

      resolve(totalLum / count < 128 ? 'light' : 'dark')
    }
    img.onerror = () => resolve('light')
    img.src = imageSrc
  })
}
