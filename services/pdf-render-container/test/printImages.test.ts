/**
 *   npx tsx --test services/pdf-render-container/test/printImages.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { imageInfo, requiredScale, downscaleForPrint, placeholderSvg, PRINT_DPI } from '../src/printImages'
import { isPixiaAsset } from '../src/printHosts'

const jpeg = (w: number, h: number, orientation?: number) => {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 40 } } }).jpeg({ quality: 90 })
  if (orientation) img = img.withMetadata({ orientation })
  return img.toBuffer()
}

test('medidas ya orientadas, como las ve Chromium', async () => {
  assert.deepEqual(await imageInfo(await jpeg(600, 400)), { width: 600, height: 400, format: 'jpeg' })
  assert.deepEqual(await imageInfo(await jpeg(600, 400, 6)), { width: 400, height: 600, format: 'jpeg' })
  assert.equal(await imageInfo(Buffer.from('no es una imagen')), null)
})

test('escala necesaria: 300 ppp sobre el lado que más exige', () => {
  // Caja de 1 pulgada (96 px CSS) → 300 px de foto.
  assert.equal(requiredScale({ width: 96, height: 96 }, { width: 3000, height: 3000 }), PRINT_DPI / 3000)
  // Foto apaisada en caja cuadrada (object-fit: cover): manda el alto.
  assert.equal(requiredScale({ width: 96, height: 96 }, { width: 6000, height: 3000 }), 300 / 3000)
  assert.equal(requiredScale({ width: 96, height: 96 }, { width: 0, height: 0 }), 1)
})

test('reduce a la medida justa y aplica la orientación EXIF', async () => {
  const src = await jpeg(4000, 3000, 6) // se ve 3000 × 4000
  const info = (await imageInfo(src))!
  const out = (await downscaleForPrint(src, info, 0.5))!
  const m = await sharp(out).metadata()
  assert.equal(m.width, 1500)
  assert.equal(m.height, 2000)
  assert.ok(!m.orientation || m.orientation === 1, 'la orientación queda aplicada a los píxeles')
})

test('no toca lo que no conviene: casi del tamaño justo, más chica de lo necesario o PNG', async () => {
  const src = await jpeg(1000, 800)
  const info = (await imageInfo(src))!
  assert.equal(await downscaleForPrint(src, info, 0.9), null)
  assert.equal(await downscaleForPrint(src, info, 1.4), null) // nunca se agranda
  assert.equal(await downscaleForPrint(src, info, 0), null) // foto oculta: se deja como está
  const png = await sharp({ create: { width: 1000, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
  assert.equal(await downscaleForPrint(png, (await imageInfo(png))!, 0.3), null) // el logo con transparencia queda igual
})

test('el SVG de medida tiene las mismas medidas que la foto', () => {
  assert.match(placeholderSvg({ width: 4284, height: 5712, format: 'jpeg' }), /width="4284" height="5712"/)
})

test('solo se reducen las fotos del almacenamiento de Pixia', () => {
  assert.equal(isPixiaAsset('https://pub-aa3db0435cb645cfbb71c0b49a045b28.r2.dev/users/s1/original/a.jpg', ''), true)
  assert.equal(isPixiaAsset('https://assets.pixiaa.com/logo-pixia.png', ''), true)
  assert.equal(isPixiaAsset('https://fonts.gstatic.com/x.woff2', ''), false)
  assert.equal(isPixiaAsset('http://assets.pixiaa.com/a.jpg', ''), false)
  assert.equal(isPixiaAsset('https://otro.ejemplo.com/a.jpg', 'otro.ejemplo.com'), true)
})
