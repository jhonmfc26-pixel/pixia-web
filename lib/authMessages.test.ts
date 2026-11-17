/**
 *   npx tsx --test lib/authMessages.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authErrorMessage, cleanCode, isCompleteCode } from './authMessages'

test('los errores de Supabase salen en español y con qué hacer', () => {
  assert.match(authErrorMessage('Token has expired or is invalid'), /^El código no es válido o ya venció/)
  assert.match(authErrorMessage('Email link is invalid or has expired'), /^El código no es válido o ya venció/)
  assert.equal(authErrorMessage('For security purposes, you can only request this after 42 seconds.'), 'Por seguridad, espera 42 segundos antes de pedir otro correo.')
  assert.match(authErrorMessage('email rate limit exceeded'), /muchos correos seguidos/)
  assert.match(authErrorMessage('Signups not allowed for otp'), /No encontramos una cuenta/)
  assert.match(authErrorMessage('Unable to validate email address: invalid format'), /no parece válido/)
  assert.match(authErrorMessage('Failed to fetch'), /No hay conexión/)
  assert.match(authErrorMessage(undefined), /Inténtalo de nuevo/)
  assert.match(authErrorMessage('algo raro'), /Inténtalo de nuevo/)
})

test('el código acepta lo que se pega del correo', () => {
  assert.equal(cleanCode('123 456'), '123456')
  assert.equal(cleanCode('123-456'), '123456')
  assert.equal(cleanCode(' 12a34b56 '), '123456')
  assert.equal(cleanCode('12345678901234'), '1234567890')
  assert.equal(isCompleteCode('123456'), true)
  assert.equal(isCompleteCode('12345678'), true)
  assert.equal(isCompleteCode('12345'), false)
  assert.equal(isCompleteCode(''), false)
})
