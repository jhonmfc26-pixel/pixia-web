/**
 *   npx tsx --test core/modules/scoring/exifReader.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readExif } from './exifReader'

const DATE = '2026:06:01 10:20:30'

/** Segmento APP1 con un IFD0 que solo trae la fecha (etiqueta 0x0132). */
function app1WithDate(): Buffer {
  const str = Buffer.from(DATE + '\0', 'ascii') // 20 bytes
  const ifd = Buffer.alloc(2 + 12 + 4)
  ifd.writeUInt16LE(1, 0)
  ifd.writeUInt16LE(0x0132, 2) // DateTime
  ifd.writeUInt16LE(2, 4) // ASCII
  ifd.writeUInt32LE(str.length, 6)
  ifd.writeUInt32LE(8 + ifd.length, 10) // el texto va justo después del IFD
  ifd.writeUInt32LE(0, 14)
  const tiff = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0]), ifd, str])
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff])
  const len = Buffer.alloc(2); len.writeUInt16BE(payload.length + 2)
  return Buffer.concat([Buffer.from([0xff, 0xe1]), len, payload])
}

/** Segmento APPn de relleno (como un perfil ICC o datos de la cámara). */
function filler(bytes: number, marker = 0xe2): Buffer {
  const len = Buffer.alloc(2); len.writeUInt16BE(bytes + 2)
  return Buffer.concat([Buffer.from([0xff, marker]), len, Buffer.alloc(bytes, 7)])
}

const SOI = Buffer.from([0xff, 0xd8])
const SOS = Buffer.from([0xff, 0xda, 0x00, 0x02])
const jpeg = (...parts: Buffer[]) => new File([Buffer.concat([SOI, ...parts, SOS])], 'foto.jpg', { type: 'image/jpeg' })

test('lee la fecha de una foto chica', async () => {
  const r = await readExif(jpeg(app1WithDate(), Buffer.alloc(10_000)))
  assert.ok(r.takenAt, 'debería traer fecha')
})

test('foto grande con el EXIF al principio: sale del primer trozo', async () => {
  const r = await readExif(jpeg(app1WithDate(), Buffer.alloc(4 * 1024 * 1024)))
  assert.ok(r.takenAt)
})

test('foto grande con el EXIF después de 600 KB de otros datos: lee el archivo entero', async () => {
  const pad = Array.from({ length: 10 }, () => filler(60_000))
  const r = await readExif(jpeg(...pad, app1WithDate(), Buffer.alloc(3 * 1024 * 1024)))
  assert.ok(r.takenAt, 'no debe perder la fecha aunque el EXIF quede lejos')
})

test('el EXIF cruza el borde del primer trozo: lee el archivo entero', async () => {
  // Rellenos hasta dejar el APP1 empezando unos bytes antes de los 512 KB.
  const pad: Buffer[] = []
  let size = 2
  while (size + 60_004 < 512 * 1024 - 30) { pad.push(filler(60_000)); size += 60_004 }
  pad.push(filler(512 * 1024 - 30 - size - 4))
  const r = await readExif(jpeg(...pad, app1WithDate(), Buffer.alloc(3 * 1024 * 1024)))
  assert.ok(r.takenAt)
})

test('sin EXIF y sin JPEG: vacío, nunca una excepción', async () => {
  assert.equal((await readExif(jpeg(filler(100), Buffer.alloc(2 * 1024 * 1024)))).takenAt, null)
  assert.equal((await readExif(new File([Buffer.from('hola')], 'x.txt'))).takenAt, null)
  assert.equal((await readExif(new File([Buffer.alloc(0)], 'vacio.jpg'))).takenAt, null)
})
