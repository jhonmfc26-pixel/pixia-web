import { Resend } from 'resend'
import { emailFrom } from './emailFrom'
import { COMMERCIAL } from '@/lib/legal'

const resend = new Resend(process.env.RESEND_API_KEY)

interface OrderConfirmationData {
  reference: string
  customerName: string
  customerEmail: string
  totalCop: number
  pagesTotal: number
  /** "Pequeño 20 × 20 cm" */
  formatLabel: string
  shippingAddress: string
  shippingCity: string
  shippingState: string
}

/**
 * Resend en modo de prueba (dominio sin verificar o EMAIL_FROM sin poner) solo
 * deja enviar al correo del dueño de la cuenta: el admin muestra qué hacer.
 */
export function explainEmailError(msg: string): string {
  if (/verify a domain|testing emails|own email address/i.test(msg)) {
    return 'Resend está en modo de prueba y solo envía a tu propio correo. Hay que verificar el dominio pixiaa.com en Resend y poner EMAIL_FROM (por ejemplo "Pixia <hola@pixiaa.com>") en las variables de Cloudflare Pages.'
  }
  return msg
}

/**
 * Envía email de confirmación post-pago aprobado.
 * Si falla NO debe romper el webhook — el pago ya está confirmado en DB.
 */
export async function sendOrderConfirmation(data: OrderConfirmationData): Promise<{ ok: boolean; error?: string }> {
  const from = emailFrom()
  const { subject, html, text } = buildOrderConfirmationEmail(data)

  try {
    const result = await resend.emails.send({ from, to: data.customerEmail, subject, html, text })

    if (result.error) {
      console.error('[email] Resend error:', result.error)
      return { ok: false, error: explainEmailError(result.error.message) }
    }

    const masked = `${data.customerEmail[0]}***@${data.customerEmail.split('@')[1] ?? ''}`
    console.log('[email] Confirmación enviada a', masked, '- id:', result.data?.id)
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] Exception:', msg)
    return { ok: false, error: msg }
  }
}

/**
 * Asunto, HTML y texto del correo de confirmación. Puro (sin enviar) para poder
 * probarlo. Nombre y dirección los escribe el cliente en el checkout: en el
 * HTML van siempre escapados.
 */
export function buildOrderConfirmationEmail(data: OrderConfirmationData, opts: { support?: string } = {}) {
  const support = opts.support ?? (process.env.EMAIL_SUPPORT || 'soporte@pixiaa.com')

  const formatCop = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pedido confirmado · Pixia</title>
      </head>
      <body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#0f0f0f;">
          <tr>
            <td align="center" style="padding:40px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#1a1a1a;border-radius:16px;overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td align="center" style="padding:48px 32px 24px 32px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:11px;letter-spacing:0.3em;color:rgba(255,255,255,0.5);text-transform:uppercase;">PIXIA</div>
                    <h1 style="margin:24px 0 8px 0;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#fff;line-height:1.3;">
                      ¡Pedido confirmado!
                    </h1>
                    <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.5;">
                      Hola ${esc(data.customerName)}, recibimos tu pago.
                    </p>
                  </td>
                </tr>

                <!-- Order details -->
                <tr>
                  <td style="padding:32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                      <tr>
                        <td style="padding-bottom:16px;">
                          <div style="font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
                            Número de orden
                          </div>
                          <div style="font-family:monospace;font-size:14px;color:#fff;">
                            ${esc(data.reference)}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-size:14px;color:rgba(255,255,255,0.7);">Álbum</td>
                              <td align="right" style="font-size:14px;color:#fff;">
                                ${esc(data.formatLabel)} · ${data.pagesTotal} páginas
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-size:14px;color:rgba(255,255,255,0.7);">Total pagado</td>
                              <td align="right" style="font-size:18px;font-weight:600;color:#fff;">
                                ${formatCop(data.totalCop)}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);">
                          <div style="font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                            Dirección de envío
                          </div>
                          <div style="font-size:14px;color:#fff;line-height:1.5;">
                            ${esc(data.shippingAddress)}<br>
                            ${esc(data.shippingCity)}, ${esc(data.shippingState)}
                          </div>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>

                <!-- Next steps -->
                <tr>
                  <td style="padding:0 32px 32px 32px;">
                    <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:20px;">
                      <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6;">
                        <strong style="color:#fff;">¿Qué sigue?</strong><br>
                        Tu álbum entrará en producción en las próximas 24 horas.
                        Te enviaremos un email con el número de seguimiento cuando se despache
                        (5–10 días hábiles).
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding:24px 32px 40px 32px;border-top:1px solid rgba(255,255,255,0.08);">
                    <p style="margin:0 0 8px 0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
                      ¿Dudas? Escríbenos a <a href="mailto:${esc(support)}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">${esc(support)}</a>
                    </p>
                    <p style="margin:16px 0 0 0;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.1em;">
                      PIXIA · Álbumes que perduran
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const text = `
Pedido confirmado

Hola ${data.customerName}, recibimos tu pago.

Número de orden: ${data.reference}
Álbum: ${data.formatLabel}, ${data.pagesTotal} páginas
Total: ${formatCop(data.totalCop)}

Envío a:
${data.shippingAddress}
${data.shippingCity}, ${data.shippingState}

Tu álbum entrará en producción en las próximas 24 horas.
Recibirás otro email con el número de seguimiento cuando se despache (5-10 días hábiles).

¿Dudas? Escríbenos a ${support}

PIXIA · Álbumes que perduran
  `.trim()

  return { subject: `Pedido confirmado: ${data.reference}`, html, text }
}

// ── Correos de estado post-venta (en impresión / enviado / entregado) ───────

export type StatusEmailKind = 'printing' | 'shipped' | 'delivered'

export interface StatusEmailData {
  kind: StatusEmailKind
  reference: string
  customerName: string
  customerEmail: string
  albumTitle?: string | null
  bookId?: string | null
  carrier?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  shippingAddress?: string | null
  shippingCity?: string | null
}

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Arma asunto, HTML y texto plano. Puro (sin enviar) para poder probarlo. */
export function buildStatusEmail(d: StatusEmailData, opts: { siteUrl?: string; support?: string } = {}) {
  const site = (opts.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pixiaa.com').replace(/\/$/, '')
  const support = opts.support ?? process.env.EMAIL_SUPPORT ?? 'soporte@pixiaa.com'
  const name = d.customerName?.split(' ')[0] || d.customerName || ''
  const album = d.albumTitle ? `«${d.albumTitle}»` : 'tu álbum'
  const viewUrl = d.bookId ? `${site}/book/${encodeURIComponent(d.bookId)}` : `${site}/mis-albumes`

  const copy = {
    printing: {
      subject: `Tu álbum está en impresión · ${d.reference}`,
      title: 'Tu álbum está en impresión',
      body: `Hola ${name}, ${album} ya está en la imprenta. Lo estamos imprimiendo y encuadernando en tapa dura; cuando salga hacia tu casa te escribimos con el número de guía.`,
    },
    shipped: {
      subject: `Tu álbum va en camino · ${d.reference}`,
      title: 'Tu álbum va en camino',
      body: `Hola ${name}, ${album} ya salió hacia tu casa. Puedes seguir el envío con estos datos:`,
    },
    delivered: {
      subject: `¡Tu álbum llegó! · ${d.reference}`,
      title: '¡Tu álbum llegó!',
      body: `Hola ${name}, la transportadora nos confirma que ${album} fue entregado. Esperamos que lo disfrutes muchos años. Revísalo hoy: si llegó con algún daño (golpes, humedad, rayones o una falla de impresión), escríbenos dentro de los próximos ${COMMERCIAL.transportDamageBusinessDays} días hábiles respondiendo este correo, con fotos del álbum y del empaque, y lo resolvemos.`,
    },
  }[d.kind]

  const tracking = d.kind === 'shipped' ? `
    <tr><td style="padding:0 32px 8px 32px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(255,255,255,0.04);border-radius:8px;">
        <tr><td style="padding:16px 20px;font-size:14px;color:rgba(255,255,255,0.7);">Transportadora</td>
            <td align="right" style="padding:16px 20px;font-size:14px;color:#fff;">${esc(d.carrier)}</td></tr>
        <tr><td style="padding:0 20px 16px 20px;font-size:14px;color:rgba(255,255,255,0.7);">Número de guía</td>
            <td align="right" style="padding:0 20px 16px 20px;font-family:monospace;font-size:14px;color:#fff;">${esc(d.trackingNumber)}</td></tr>
        ${d.shippingAddress ? `<tr><td colspan="2" style="padding:0 20px 16px 20px;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.5;">Destino: ${esc(d.shippingAddress)}${d.shippingCity ? `, ${esc(d.shippingCity)}` : ''}</td></tr>` : ''}
      </table>
      ${d.trackingUrl ? `<p style="margin:16px 0 0 0;text-align:center;"><a href="${esc(d.trackingUrl)}" style="color:#F08A72;font-size:14px;">Rastrear el envío</a></p>` : ''}
    </td></tr>` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(copy.title)} · Pixia</title></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0f0f;"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#1a1a1a;border-radius:16px;overflow:hidden;">
  <tr><td align="center" style="padding:44px 32px 20px 32px;">
    <div style="font-size:11px;letter-spacing:0.3em;color:rgba(255,255,255,0.5);text-transform:uppercase;">PIXIA</div>
    <h1 style="margin:22px 0 12px 0;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#fff;line-height:1.3;">${esc(copy.title)}</h1>
    <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">${esc(copy.body)}</p>
  </td></tr>
  ${tracking}
  <tr><td align="center" style="padding:24px 32px 8px 32px;">
    <a href="${esc(viewUrl)}" style="display:inline-block;background:#E8553A;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px;">Ver mi álbum</a>
  </td></tr>
  <tr><td align="center" style="padding:20px 32px 36px 32px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;">
    Pedido <span style="font-family:monospace;">${esc(d.reference)}</span> · ¿Dudas? Escríbenos a ${esc(support)}
  </td></tr>
</table></td></tr></table></body></html>`

  const text = [
    copy.title, '', copy.body,
    ...(d.kind === 'shipped' ? ['', `Transportadora: ${d.carrier ?? ''}`, `Número de guía: ${d.trackingNumber ?? ''}`, ...(d.trackingUrl ? [`Rastreo: ${d.trackingUrl}`] : [])] : []),
    '', `Ver mi álbum: ${viewUrl}`, `Pedido ${d.reference} · ¿Dudas? ${support}`, '', 'PIXIA · Álbumes que perduran',
  ].join('\n')

  return { subject: copy.subject, html, text }
}

/** Envía el correo de estado. Nunca lanza: el cambio de estado ya quedó guardado. */
export async function sendOrderStatusEmail(d: StatusEmailData): Promise<{ ok: boolean; error?: string }> {
  const from = emailFrom()
  const { subject, html, text } = buildStatusEmail(d)
  try {
    const result = await resend.emails.send({ from, to: d.customerEmail, subject, html, text, replyTo: process.env.EMAIL_SUPPORT || undefined })
    if (result.error) {
      console.error('[email] Resend error (estado):', result.error)
      return { ok: false, error: explainEmailError(result.error.message) }
    }
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] Exception (estado):', msg)
    return { ok: false, error: msg }
  }
}

// ── PQR (peticiones, quejas y reclamos) ────────────────────────────────────

export interface PqrEmailData {
  radicado: string
  name: string
  email: string
  typeLabel: string
  createdAtLabel: string   // fecha y hora de radicación (Bogotá)
  dueDateLabel: string     // fecha límite de respuesta
  message: string
  response?: string | null
}

function pqrShell(title: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(title)} · Pixia</title></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0f0f;"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#1a1a1a;border-radius:16px;overflow:hidden;">
<tr><td style="padding:40px 32px;">
<div style="font-size:11px;letter-spacing:0.3em;color:rgba(255,255,255,0.5);text-align:center;">PIXIA</div>
<h1 style="margin:20px 0 16px 0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#fff;text-align:center;">${esc(title)}</h1>
${inner}
</td></tr></table></td></tr></table></body></html>`
}

const pre = (s: string) => esc(s).replace(/\n/g, '<br>')

/** Constancia de radicación para el cliente. Puro, para poder probarlo. */
export function buildPqrReceiptEmail(d: PqrEmailData, opts: { siteUrl?: string } = {}) {
  const site = (opts.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pixiaa.com').replace(/\/$/, '')
  const track = `${site}/soporte/seguimiento?radicado=${encodeURIComponent(d.radicado)}`
  const row = (k: string, v: string, mono = false) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:rgba(255,255,255,0.6);">${k}</td><td align="right" style="padding:6px 0;font-size:14px;color:#fff;${mono ? 'font-family:monospace;' : ''}">${esc(v)}</td></tr>`
  const html = pqrShell('Recibimos tu solicitud', `
<p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.75);margin:0 0 20px 0;">Hola ${esc(d.name.split(' ')[0])}, quedó radicada con estos datos. Guárdalos para hacerle seguimiento.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px 18px;">
${row('Número de radicado', d.radicado, true)}${row('Fecha y hora', d.createdAtLabel)}${row('Tipo', d.typeLabel)}${row('Respuesta a más tardar', d.dueDateLabel)}
</table>
<p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.55);margin:20px 0 6px 0;">Tu mensaje:</p>
<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.8);margin:0;padding:12px 16px;border-left:2px solid #E8553A;background:rgba(255,255,255,0.02);">${pre(d.message)}</p>
<p style="text-align:center;margin:28px 0 8px 0;"><a href="${esc(track)}" style="display:inline-block;background:#E8553A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:15px;">Ver el estado</a></p>
<p style="font-size:12px;line-height:1.6;color:rgba(255,255,255,0.45);text-align:center;margin:16px 0 0 0;">Si necesitas agregar fotos o información, responde este correo indicando tu número de radicado.</p>`)
  const text = [
    'Recibimos tu solicitud', '',
    `Número de radicado: ${d.radicado}`, `Fecha y hora: ${d.createdAtLabel}`, `Tipo: ${d.typeLabel}`, `Respuesta a más tardar: ${d.dueDateLabel}`,
    '', 'Tu mensaje:', d.message, '', `Ver el estado: ${track}`,
    'Si necesitas agregar fotos o información, responde este correo indicando tu número de radicado.',
  ].join('\n')
  return { subject: `Radicado ${d.radicado} · Recibimos tu solicitud`, html, text }
}

/** Respuesta de fondo al cliente. */
export function buildPqrResponseEmail(d: PqrEmailData) {
  const html = pqrShell('Respuesta a tu solicitud', `
<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6);margin:0 0 18px 0;text-align:center;">Radicado <span style="font-family:monospace;color:#fff;">${esc(d.radicado)}</span> · ${esc(d.typeLabel)}</p>
<p style="font-size:15px;line-height:1.7;color:rgba(255,255,255,0.85);margin:0;">Hola ${esc(d.name.split(' ')[0])},</p>
<p style="font-size:15px;line-height:1.7;color:rgba(255,255,255,0.85);margin:12px 0 0 0;">${pre(d.response ?? '')}</p>
<p style="font-size:12px;line-height:1.6;color:rgba(255,255,255,0.45);margin:28px 0 0 0;">Si no estás de acuerdo con esta respuesta, puedes responder este correo o acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).</p>`)
  const text = [`Radicado ${d.radicado} · ${d.typeLabel}`, '', `Hola ${d.name.split(' ')[0]},`, '', d.response ?? '', '',
    'Si no estás de acuerdo con esta respuesta, puedes responder este correo o acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).'].join('\n')
  return { subject: `Respuesta a tu solicitud ${d.radicado}`, html, text }
}

async function sendRaw(to: string | string[], m: { subject: string; html: string; text: string }, replyTo?: string) {
  const from = emailFrom()
  try {
    const result = await resend.emails.send({ from, to, subject: m.subject, html: m.html, text: m.text, replyTo })
    if (result.error) { console.error('[email] Resend error (pqr):', result.error); return { ok: false, error: explainEmailError(result.error.message) } }
    return { ok: true as const }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] Exception (pqr):', msg)
    return { ok: false, error: msg }
  }
}

/** Aviso interno al equipo (ALERT_EMAIL o, si falta, ADMIN_EMAILS). Nunca lanza. */
export async function sendTeamAlert(subject: string, lines: string[]) {
  const team = (process.env.ALERT_EMAIL || process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (team.length === 0) { console.error('[email] Alerta sin destinatario (falta ALERT_EMAIL):', subject); return { ok: false as const, error: 'sin destinatario' } }
  return sendRaw(team, {
    subject: `[Pixia] ${subject}`,
    html: lines.map(l => `<p>${esc(l)}</p>`).join(''),
    text: lines.join('\n\n'),
  })
}

/** Constancia al cliente + aviso interno al equipo. Nunca lanza. */
export async function sendPqrReceivedEmails(d: PqrEmailData) {
  const customer = await sendRaw(d.email, buildPqrReceiptEmail(d), process.env.EMAIL_SUPPORT || undefined)
  const team = (process.env.PQR_NOTIFY_EMAILS || process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (team.length) {
    await sendRaw(team, {
      subject: `[PQR] ${d.typeLabel} · ${d.radicado} · vence ${d.dueDateLabel}`,
      html: `<p><b>${esc(d.typeLabel)}</b> de ${esc(d.name)} (${esc(d.email)})</p><p>Radicado ${esc(d.radicado)} · ${esc(d.createdAtLabel)} · responder a más tardar el ${esc(d.dueDateLabel)}</p><p>${pre(d.message)}</p><p>Responder desde /admin/pqr</p>`,
      text: `${d.typeLabel} de ${d.name} (${d.email})\nRadicado ${d.radicado} · ${d.createdAtLabel} · vence ${d.dueDateLabel}\n\n${d.message}\n\nResponder desde /admin/pqr`,
    }, d.email)
  }
  return customer
}

export async function sendPqrResponseEmail(d: PqrEmailData) {
  return sendRaw(d.email, buildPqrResponseEmail(d), process.env.EMAIL_SUPPORT || undefined)
}
