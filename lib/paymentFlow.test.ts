/**
 * El camino del pago de punta a punta, con las rutas reales:
 *   /api/orders/create → webhook de Wompi → álbum congelado + PDF encolado
 *
 * Supabase, Wompi y Resend se reemplazan por un doble en memoria a nivel de
 * `fetch`: el código de las rutas y supabase-js corren tal cual.
 *
 *   npx tsx --test lib/paymentFlow.test.ts
 */
import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
process.env.WOMPI_API_URL = 'https://wompi.test/v1'
process.env.WOMPI_EVENTS_SECRET = 'events-secret'
process.env.WOMPI_INTEGRITY_SECRET = 'integrity-secret'
process.env.RESEND_API_KEY = 're_test'
process.env.ALERT_EMAIL = 'equipo@pixiaa.com'

// ── Doble en memoria ─────────────────────────────────────────────────────────

type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}
const wompi = new Map<string, Row>()
const emails: { to: string[]; subject: string }[] = []
const tokens: Record<string, string> = { 'token-ana': 'user-ana', 'token-beto': 'user-beto' }
/** Fallas inyectadas: `${METHOD} ${tabla}` → cuántas veces falla. */
const failures = new Map<string, number>()

const PRIMARY_KEY: Record<string, string> = { blueprints: 'id', orders: 'reference', pdf_generation_jobs: 'blueprint_id' }

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [col, expr] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(col)) continue
    const value = row[col]
    if (expr === 'is.null') { if (value != null) return false; continue }
    if (expr === 'not.is.null') { if (value == null) return false; continue }
    const dot = expr.indexOf('.')
    const op = expr.slice(0, dot)
    const arg = expr.slice(dot + 1)
    if (op === 'eq') { if (String(value) !== arg) return false }
    else if (op === 'neq') { if (String(value) === arg) return false }
    else if (op === 'gte') { if (!(String(value) >= arg)) return false }
    else throw new Error(`filtro no soportado por el doble: ${col}=${expr}`)
  }
  return true
}

function project(row: Row, select: string | null): Row {
  if (!select || select === '*') return { ...row }
  const out: Row = {}
  for (const spec of select.split(',')) {
    const json = spec.match(/^(\w+):(\w+)->>(\w+)$/)
    if (json) { out[json[1]] = (row[json[2]] as Row | null)?.[json[3]] ?? null; continue }
    out[spec] = row[spec] ?? null
  }
  return out
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = input instanceof Request ? input : new Request(String(input), init)
  const url = new URL(req.url)

  if (url.host === 'wompi.test') {
    const tx = wompi.get(url.pathname.split('/').pop()!)
    return tx ? json({ data: tx }) : json({ error: 'not found' }, 404)
  }
  if (url.host === 'api.resend.com') {
    const body = await req.json() as { to: string | string[]; subject: string }
    emails.push({ to: [body.to].flat(), subject: body.subject })
    return json({ id: `email-${emails.length}` })
  }
  if (url.host !== 'db.test') throw new Error(`fetch inesperado en la prueba: ${req.url}`)

  if (url.pathname === '/auth/v1/user') {
    const userId = tokens[(req.headers.get('authorization') ?? '').replace('Bearer ', '')]
    return userId ? json({ id: userId, aud: 'authenticated', email: `${userId}@test.co` }) : json({ msg: 'invalid JWT' }, 401)
  }

  const table = url.pathname.replace('/rest/v1/', '')
  const rows = (db[table] ??= [])
  const failKey = `${req.method} ${table}`
  if ((failures.get(failKey) ?? 0) > 0) {
    failures.set(failKey, failures.get(failKey)! - 1)
    return json({ message: 'falla inyectada', code: 'XX000' }, 500)
  }
  const select = url.searchParams.get('select')
  const wantsObject = (req.headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const reply = (found: Row[], status = 200) => {
    const out = found.map(r => project(r, select))
    if (wantsObject) {
      return out.length === 1 ? json(out[0], status)
        : json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${out.length} rows` }, 406)
    }
    return json(out, status)
  }

  if (req.method === 'GET') {
    let found = rows.filter(r => matches(r, url.searchParams))
    const order = url.searchParams.get('order')
    if (order) {
      const [col, dir] = order.split('.')
      found = [...found].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1))
    }
    const limit = url.searchParams.get('limit')
    if (limit) found = found.slice(0, Number(limit))
    return reply(found)
  }
  if (req.method === 'POST') {
    const pk = PRIMARY_KEY[table]
    const upsert = (req.headers.get('prefer') ?? '').includes('resolution=merge-duplicates')
    const written: Row[] = []
    for (const incoming of [await req.json()].flat() as Row[]) {
      const existing = rows.find(r => r[pk] === incoming[pk])
      if (existing && !upsert) return json({ code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"` }, 409)
      if (existing) { Object.assign(existing, incoming); written.push(existing) }
      else {
        const row = { ...incoming }
        if (table === 'orders') row.id ??= `order-${rows.length + 1}`
        rows.push(row); written.push(row)
      }
    }
    return reply(written, 201)
  }
  if (req.method === 'PATCH') {
    const patch = await req.json() as Row
    const found = rows.filter(r => matches(r, url.searchParams))
    for (const r of found) Object.assign(r, patch)
    return reply(found)
  }
  throw new Error(`método no soportado por el doble: ${req.method}`)
}
globalThis.fetch = fakeFetch as typeof fetch

// ── Utilidades de la prueba ──────────────────────────────────────────────────

// Las rutas leen las variables de entorno al cargarse: se importan después de fijarlas.
type Handler = (req: NextRequest) => Promise<Response>
let createOrder: Handler, wompiWebhook: Handler, persist: Handler
let TERMS_VERSION: string
let pagesOf: (book: unknown) => number
let countRealPages: typeof import('@/core/modules/foldModel/validate').countRealPages

before(async () => {
  createOrder = (await import('@/app/api/orders/create/route')).POST
  wompiWebhook = (await import('@/app/api/orders/webhook/route')).POST
  persist = (await import('@/app/api/blueprints/persist/route')).POST
  TERMS_VERSION = (await import('@/lib/legal')).TERMS_VERSION
  const { foldsFromBlueprint } = await import('@/core/modules/foldModel/fromBlueprint')
  const { normalizeBook } = await import('@/core/modules/album/normalizeBook')
  countRealPages = (await import('@/core/modules/foldModel/validate')).countRealPages
  pagesOf = (book) => countRealPages(foldsFromBlueprint(normalizeBook(book, BOOK)).structure)
})

const BOOK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function album(n: number, over: Row = {}) {
  const oris = ['landscape', 'portrait', 'landscape', 'landscape', 'portrait', 'square']
  return {
    id: BOOK, occasion: 'viaje', format: '30x30', style: 'con-margen', status: 'draft', version: 1,
    cover: { photoId: 'p0', templateId: '', title: 'Perú 2026', kind: 'photo' },
    narrative: { title: 'Perú 2026' },
    spreads: [{
      id: 's0', act: 'desarrollo', layout: 'single',
      photos: Array.from({ length: n }, (_, i) => {
        const o = oris[i % oris.length]
        const [width, height] = o === 'landscape' ? [4000, 3000] : o === 'portrait' ? [3000, 4000] : [3000, 3000]
        return {
          id: `p${i}`, url: `https://assets.pixiaa.com/users/s1/original/p${i}.jpg`, width, height, orientation: o,
          score: { finalScore: ((i * 37) % 100) / 100 }, takenAt: new Date(Date.UTC(2026, 5, 1, 10) + i * 1_200_000).toISOString(),
        }
      }),
    }],
    ...over,
  }
}

function post(url: string, body: unknown, token?: string) {
  return new NextRequest(`https://pixiaa.com${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
}

async function create(book: ReturnType<typeof album>, opts: { token?: string | null; pagesTotal?: number } = {}) {
  const pages = opts.pagesTotal ?? pagesOf(book)
  const res = await createOrder(post('/api/orders/create', {
    bookId: BOOK, bookSnapshot: book, sessionId: 's1', pagesTotal: pages, termsVersion: TERMS_VERSION,
    fewerPagesAck: pages < 20 ? pages : undefined,
    customer: { name: 'Ana Pérez', email: 'ana@test.co', phone: '3001234567' },
    shipping: { address: 'Calle 1 # 2-3', city: 'Barranquilla', state: 'Atlántico' },
  }, opts.token === null ? undefined : (opts.token ?? 'token-ana')))
  return { status: res.status, body: await res.json() as Row }
}

let txCount = 0
async function webhook(reference: string, status: string, txId = `tx-${++txCount}`, amountInCents?: number) {
  const order = db.orders.find(o => o.reference === reference)!
  const transaction = { id: txId, reference, status, amount_in_cents: amountInCents ?? Number(order.total_cop) * 100, payment_method_type: 'CARD' }
  wompi.set(txId, transaction)
  const timestamp = 1_800_000_000
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${txId}${status}${transaction.amount_in_cents}${timestamp}events-secret`))
  const checksum = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  const res = await wompiWebhook(post('/api/orders/webhook', {
    event: 'transaction.updated', data: { transaction }, timestamp,
    signature: { checksum, properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
  }))
  return { status: res.status, body: await res.json() as Row, txId }
}

const blueprint = () => db.blueprints.find(b => b.id === BOOK)!
const photoCount = (row: Row) => (row.spreads as { photos: unknown[] }[])[0].photos.length
const mailsTo = (to: string) => emails.filter(e => e.to.includes(to))

beforeEach(() => {
  for (const t of ['blueprints', 'orders', 'pdf_generation_jobs']) db[t] = []
  emails.length = 0
  wompi.clear()
  failures.clear()
})

// ── Casos ────────────────────────────────────────────────────────────────────

test('sin sesión no se crea la orden', async () => {
  assert.equal((await create(album(30), { token: null })).status, 401)
  assert.equal((await create(album(30), { token: 'token-falso' })).status, 401)
  assert.equal(db.orders.length, 0)
  assert.equal(db.blueprints.length, 0)
})

test('compra normal: álbum guardado, orden con la copia cobrada, pago → congelado + PDF + un correo', async () => {
  const book = album(40)
  const created = await create(book)
  assert.equal(created.status, 200, JSON.stringify(created.body))
  assert.equal(blueprint().user_id, 'user-ana')
  assert.equal(blueprint().status, 'draft')
  const order = db.orders[0]
  assert.equal(order.pages_total, pagesOf(book))
  assert.equal(order.user_id, 'user-ana')
  assert.equal((order.book_snapshot as Row).pageCount, pagesOf(book))
  assert.equal(created.body.amountInCents, Number(order.total_cop) * 100)

  const paid = await webhook(String(order.reference), 'APPROVED')
  assert.deepEqual([paid.status, paid.body.status], [200, 'approved'])
  assert.equal(order.payment_status, 'approved')
  assert.equal(order.print_status, 'paid')
  assert.equal(blueprint().status, 'ordered')
  assert.deepEqual(db.pdf_generation_jobs.map(j => [j.blueprint_id, j.order_reference, j.status]), [[BOOK, order.reference, 'pendiente']])
  assert.equal(mailsTo('ana@test.co').length, 1)
})

test('el mismo aviso de Wompi repetido no reencola ni manda otro correo', async () => {
  const { body } = await create(album(30))
  const first = await webhook(String(body.reference), 'APPROVED')
  db.pdf_generation_jobs[0].status = 'pdf_listo'
  const again = await webhook(String(body.reference), 'APPROVED', first.txId)
  assert.deepEqual([again.status, again.body.status], [200, 'already-processed'])
  assert.equal(db.pdf_generation_jobs[0].status, 'pdf_listo')
  assert.equal(mailsTo('ana@test.co').length, 1)
})

test('dos avisos del mismo pago a la vez: un solo correo y un solo PDF', async () => {
  const { body } = await create(album(30))
  const results = await Promise.all([webhook(String(body.reference), 'APPROVED', 'tx-same'), webhook(String(body.reference), 'APPROVED', 'tx-same')])
  assert.deepEqual(results.map(r => r.status), [200, 200])
  assert.equal(mailsTo('ana@test.co').length, 1)
  assert.equal(db.pdf_generation_jobs.length, 1)
})

test('C2 · editar el álbum entre crear la orden y pagar: se imprime lo que se pagó', async () => {
  const book = album(30)
  const { body } = await create(book)
  const paidPages = pagesOf(book)

  // Otra pestaña: el cliente agrega 50 fotos y cambia de tamaño antes de pagar.
  const bigger = album(80, { format: 'a4' })
  const saved = await persist(post('/api/blueprints/persist', { blueprint: bigger, sessionId: 's1' }, 'token-ana'))
  assert.equal(saved.status, 200)
  assert.equal(photoCount(blueprint()), 80)
  assert.equal(blueprint().format, 'a4')

  await webhook(String(body.reference), 'APPROVED')
  assert.equal(blueprint().status, 'ordered')
  assert.equal(photoCount(blueprint()), 30)
  assert.equal(blueprint().format, '30x30')
  assert.equal(blueprint().page_count, paidPages)
  assert.equal(countRealPages(blueprint().structure as never), paidPages)
  assert.equal(db.orders[0].pages_total, paidPages)
})

test('C2 · el álbum cambió desde que se abrió el checkout: no se cobra, se pide recargar', async () => {
  const first = await create(album(30))
  assert.equal(first.status, 200)
  // La cuenta tiene el de 30 fotos; el navegador muestra (y manda) uno de 80.
  const stale = await create(album(80))
  assert.equal(stale.status, 409)
  assert.match(String(stale.body.error), /Recárgala/)
  assert.equal(db.orders.length, 1)
  assert.equal(photoCount(blueprint()), 30)
})

test('C1 · un álbum pagado no se vuelve a cobrar ni vuelve a borrador', async () => {
  const book = album(30)
  const { body } = await create(book)
  await webhook(String(body.reference), 'APPROVED')

  const again = await create(book)
  assert.equal(again.status, 409)
  assert.match(String(again.body.error), /ya fue pedido/)
  assert.equal(blueprint().status, 'ordered')
  assert.equal(db.orders.length, 1)

  // Tampoco se puede modificar guardando desde el editor.
  const edit = await persist(post('/api/blueprints/persist', { blueprint: album(60), sessionId: 's1' }, 'token-ana'))
  assert.equal(edit.status, 409)
  assert.equal(photoCount(blueprint()), 30)
})

test('guardar desde el navegador nunca cambia el estado del álbum', async () => {
  const res = await persist(post('/api/blueprints/persist', { blueprint: album(30, { status: 'ordered' }), sessionId: 's1' }, 'token-ana'))
  assert.equal(res.status, 200)
  assert.equal(blueprint().status, 'draft')
})

test('el álbum de otra persona no se puede pagar ni sobrescribir', async () => {
  await create(album(30))
  const other = await create(album(30), { token: 'token-beto' })
  assert.equal(other.status, 403)
  const edit = await persist(post('/api/blueprints/persist', { blueprint: album(60), sessionId: 's9' }, 'token-beto'))
  assert.equal(edit.status, 403)
  assert.equal(blueprint().user_id, 'user-ana')
  assert.equal(db.orders.length, 1)
})

test('A3 · si el álbum no se puede guardar no se crea la orden', async () => {
  failures.set('POST blueprints', 1)
  const res = await create(album(30))
  assert.equal(res.status, 500)
  assert.equal(db.orders.length, 0)
})

test('C3 · no se cobra un álbum con fotos que no terminaron de subir', async () => {
  const book = album(30)
  book.spreads[0].photos[4].url = 'data:image/jpeg;base64,AAAA'
  const res = await create(book)
  assert.equal(res.status, 409)
  assert.match(String(res.body.error), /no terminó de subir/)
  assert.equal(db.orders.length, 0)
})

test('pago rechazado: el álbum sigue editable y se puede volver a intentar', async () => {
  const book = album(30)
  const first = await create(book)
  await webhook(String(first.body.reference), 'DECLINED')
  assert.equal(db.orders[0].payment_status, 'declined')
  assert.equal(blueprint().status, 'draft')
  assert.equal(db.pdf_generation_jobs.length, 0)
  assert.equal(emails.length, 0)

  const second = await create(book)
  assert.equal(second.status, 200)
  await webhook(String(second.body.reference), 'APPROVED')
  assert.equal(blueprint().status, 'ordered')
  assert.equal(db.pdf_generation_jobs[0].order_reference, second.body.reference)
})

test('pago doble del mismo álbum: se imprime el primero y se avisa al equipo', async () => {
  const book = album(30)
  const a = await create(book)
  const b = await create(book)
  assert.deepEqual([a.status, b.status], [200, 200])

  await webhook(String(a.body.reference), 'APPROVED')
  db.pdf_generation_jobs[0].status = 'generando_pdf'
  db.orders.find(o => o.reference === a.body.reference)!.paid_at = '2026-11-13T10:00:00.000Z'

  const second = await webhook(String(b.body.reference), 'APPROVED')
  assert.equal(second.status, 200)
  assert.deepEqual(db.pdf_generation_jobs.map(j => [j.order_reference, j.status]), [[a.body.reference, 'generando_pdf']])
  assert.equal(mailsTo('equipo@pixiaa.com').filter(e => /Pago doble/.test(e.subject)).length, 1)
  // El cliente pagó de verdad las dos veces: recibe las dos confirmaciones.
  assert.equal(mailsTo('ana@test.co').length, 2)
})

test('si falla congelar el álbum, Wompi reintenta y queda congelado y encolado', async () => {
  const { body } = await create(album(30))
  failures.set('PATCH blueprints', 1)
  const first = await webhook(String(body.reference), 'APPROVED', 'tx-retry')
  assert.equal(first.status, 500)
  assert.equal(db.orders[0].payment_status, 'approved') // el pago es real
  assert.equal(blueprint().status, 'draft')
  assert.equal(db.pdf_generation_jobs.length, 0)

  const retry = await webhook(String(body.reference), 'APPROVED', 'tx-retry')
  assert.equal(retry.status, 200)
  assert.equal(blueprint().status, 'ordered')
  assert.equal(db.pdf_generation_jobs.length, 1)
  assert.equal(mailsTo('ana@test.co').length, 1)
})

test('M4 · pago aprobado que Wompi anula: queda anulado y se avisa al equipo', async () => {
  const { body } = await create(album(30))
  const paid = await webhook(String(body.reference), 'APPROVED')
  const voided = await webhook(String(body.reference), 'VOIDED', paid.txId)
  assert.equal(voided.status, 200)
  assert.equal(db.orders[0].payment_status, 'voided')
  assert.equal(mailsTo('equipo@pixiaa.com').filter(e => /Pago anulado/.test(e.subject)).length, 1)
})

test('un pago aprobado no retrocede a rechazado o pendiente', async () => {
  const { body } = await create(album(30))
  await webhook(String(body.reference), 'APPROVED')
  for (const status of ['DECLINED', 'PENDING', 'ERROR']) {
    const res = await webhook(String(body.reference), status)
    assert.equal(res.status, 200)
    assert.equal(db.orders[0].payment_status, 'approved', status)
  }
})

test('firma inválida o monto distinto: el pago no se aprueba', async () => {
  const { body } = await create(album(30))
  const bad = await wompiWebhook(post('/api/orders/webhook', {
    event: 'transaction.updated', timestamp: 1, data: { transaction: { id: 'x', reference: body.reference, status: 'APPROVED', amount_in_cents: 1 } },
    signature: { checksum: 'falso', properties: ['transaction.id'] },
  }))
  assert.equal(bad.status, 401)
  // Wompi cobró menos de lo que vale la orden.
  const res = await webhook(String(body.reference), 'APPROVED', 'tx-barato', 100_00)
  assert.equal(res.status, 400)
  assert.equal(db.orders[0].payment_status, 'pending')
  assert.equal(blueprint().status, 'draft')
})
