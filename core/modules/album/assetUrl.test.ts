/**
 *   npx tsx --test core/modules/album/assetUrl.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalAssetUrl, LEGACY_R2_DEV_HOST } from './assetUrl'
import { normalizeBook } from './normalizeBook'

const OLD = `https://${LEGACY_R2_DEV_HOST}/users/s1/original/p1.jpg`
const PROD = 'https://assets.pixiaa.com'

test('con el dominio de producción configurado, las fotos viejas pasan a él (misma ruta)', () => {
  assert.equal(canonicalAssetUrl(OLD, PROD), `${PROD}/users/s1/original/p1.jpg`)
  assert.equal(canonicalAssetUrl(OLD, `${PROD}/`), `${PROD}/users/s1/original/p1.jpg`)
  assert.equal(canonicalAssetUrl(`https://${LEGACY_R2_DEV_HOST}/users/s1/display/p1.jpg?v=2`, PROD), `${PROD}/users/s1/display/p1.jpg?v=2`)
})

test('sin dominio de producción (o si sigue siendo r2.dev), nada cambia', () => {
  assert.equal(canonicalAssetUrl(OLD, undefined), OLD)
  assert.equal(canonicalAssetUrl(OLD, ''), OLD)
  assert.equal(canonicalAssetUrl(OLD, `https://${LEGACY_R2_DEV_HOST}`), OLD)
  assert.equal(canonicalAssetUrl(OLD, 'https://otro-bucket.r2.dev'), OLD)
  assert.equal(canonicalAssetUrl(OLD, 'no es una dirección'), OLD)
})

test('solo se tocan fotos del bucket de Pixia', () => {
  for (const u of ['https://assets.pixiaa.com/a.jpg', 'https://otro.ejemplo.com/a.jpg', 'data:image/jpeg;base64,AAAA', 'blob:https://pixiaa.com/1', '']) {
    assert.equal(canonicalAssetUrl(u, PROD), u)
  }
  assert.equal(canonicalAssetUrl(`http://${LEGACY_R2_DEV_HOST}/a.jpg`, PROD), `http://${LEGACY_R2_DEV_HOST}/a.jpg`)
})

test('al leer un álbum, sus fotos salen por el dominio configurado', () => {
  const before = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL = PROD
  try {
    const book = normalizeBook({
      id: 'b1', occasion: 'viaje', format: '30x30',
      cover: { photoId: 'p1', templateId: '', title: 'x', kind: 'photo' },
      spreads: [{ id: 's0', layout: 'single', photos: [{ id: 'p1', url: OLD, thumbnailUrl: OLD.replace('original', 'display'), width: 4000, height: 3000 }] }],
    }, 'b1')
    const p = book.spreads[0].photos[0]
    assert.equal(p.url, `${PROD}/users/s1/original/p1.jpg`)
    assert.equal(p.thumbnailUrl, `${PROD}/users/s1/display/p1.jpg`)
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL
    else process.env.NEXT_PUBLIC_R2_PUBLIC_URL = before
  }
})
