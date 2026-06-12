import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface OrderConfirmationData {
  reference: string
  customerName: string
  customerEmail: string
  totalCop: number
  pagesTotal: number
  shippingAddress: string
  shippingCity: string
  shippingState: string
}

/**
 * Envía email de confirmación post-pago aprobado.
 * Si falla NO debe romper el webhook — el pago ya está confirmado en DB.
 */
export async function sendOrderConfirmation(data: OrderConfirmationData): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.EMAIL_FROM || 'Pixia <onboarding@resend.dev>'
  const support = process.env.EMAIL_SUPPORT || 'soporte@pixiaa.com'

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
                      Hola ${data.customerName}, recibimos tu pago.
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
                            ${data.reference}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-size:14px;color:rgba(255,255,255,0.7);">Álbum</td>
                              <td align="right" style="font-size:14px;color:#fff;">
                                ${data.pagesTotal} páginas · 30×30 cm
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
                            ${data.shippingAddress}<br>
                            ${data.shippingCity}, ${data.shippingState}
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
                      ¿Dudas? Escríbenos a <a href="mailto:${support}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">${support}</a>
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
Álbum: ${data.pagesTotal} páginas, 30×30 cm
Total: ${formatCop(data.totalCop)}

Envío a:
${data.shippingAddress}
${data.shippingCity}, ${data.shippingState}

Tu álbum entrará en producción en las próximas 24 horas.
Recibirás otro email con el número de seguimiento cuando se despache (5-10 días hábiles).

¿Dudas? Escríbenos a ${support}

PIXIA · Álbumes que perduran
  `.trim()

  try {
    const result = await resend.emails.send({
      from,
      to: data.customerEmail,
      subject: `Pedido confirmado: ${data.reference}`,
      html,
      text,
    })

    if (result.error) {
      console.error('[email] Resend error:', result.error)
      return { ok: false, error: result.error.message }
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
