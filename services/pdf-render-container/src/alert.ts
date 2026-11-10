import type { QueueJob } from './jobs'

/**
 * Alerta a Jhon cuando una orden PAGADA se queda sin PDF (agotó los
 * intentos). Es el peor error posible del negocio — plata recibida sin
 * producto — así que tiene que llegar a un humano, no solo a un log.
 *
 * Usa la API REST de Resend directo (sin el SDK) para no sumar dependencias
 * a la imagen. Si falta configuración o Resend falla, devuelve false y el
 * job queda con alerted_at = null: el próximo barrido lo vuelve a intentar.
 */
export async function sendPdfFailureAlert(job: QueueJob): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL
  const from = process.env.EMAIL_FROM || 'Pixia <onboarding@resend.dev>'
  if (!apiKey || !to) {
    console.error(`[pdf-render-container] ⚠️ ALERTA SIN ENVIAR (falta RESEND_API_KEY o ALERT_EMAIL): orden ${job.order_reference} / álbum ${job.blueprint_id} sin PDF — ${job.error_message}`)
    return false
  }

  const subject = `🚨 Pixia: orden ${job.order_reference} pagada SIN PDF`
  const text = [
    'Una orden pagada agotó los intentos de generación del PDF de impresión.',
    '',
    `Orden:     ${job.order_reference}`,
    `Álbum:     ${job.blueprint_id}`,
    `Intentos:  ${job.attempt_count}`,
    `Error:     ${job.error_message ?? '(sin mensaje)'}`,
    '',
    'Para reintentar después de corregir la causa, en el SQL editor de Supabase:',
    `  UPDATE pdf_generation_jobs SET status = 'pendiente', attempt_count = 0, alerted_at = NULL WHERE blueprint_id = '${job.blueprint_id}';`,
    '',
    'El próximo barrido (≤ 5 min) lo vuelve a tomar.',
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    if (!res.ok) {
      console.error(`[pdf-render-container] Resend respondió ${res.status} al enviar alerta:`, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[pdf-render-container] Error enviando alerta:', err)
    return false
  }
}

/** Alerta genérica por correo a Jhon (almacenamiento, limpieza). Mismo canal que la de PDF. */
export async function sendAlert(subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL
  const from = process.env.EMAIL_FROM || 'Pixia <onboarding@resend.dev>'
  if (!apiKey || !to) {
    console.error(`[pdf-render-container] ⚠️ ALERTA SIN ENVIAR (falta RESEND_API_KEY o ALERT_EMAIL): ${subject}`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    if (!res.ok) console.error(`[pdf-render-container] Resend respondió ${res.status}:`, await res.text().catch(() => ''))
    return res.ok
  } catch (err) {
    console.error('[pdf-render-container] Error enviando alerta:', err)
    return false
  }
}
