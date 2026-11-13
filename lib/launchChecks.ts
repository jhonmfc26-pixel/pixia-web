/**
 * Revisión de paso a producción: qué le falta a ESTA versión de la web para
 * vender de verdad. Lo muestra /admin/lanzamiento.
 *
 * Solo mira la configuración (variables de entorno y datos legales). Nunca
 * devuelve el valor de una llave: solo si está, y de qué ambiente es.
 */
import { LEGAL_ENTITY, isPlaceholder } from '@/lib/legal'
import { RESEND_TEST_FROM } from '@/lib/emailFrom'
import { wompiSetup } from '@/lib/wompiConfig'

type Env = Record<string, string | undefined>

export type CheckStatus = 'ok' | 'aviso' | 'falta'

export interface LaunchCheck {
  group: 'Pagos' | 'Correos' | 'Datos legales' | 'Fotos y PDF' | 'Admin' | 'Sitio'
  label: string
  status: CheckStatus
  detail: string
}

const has = (env: Env, name: string) => !!env[name]?.trim()
const missing = (env: Env, names: string[]) => names.filter(n => !has(env, n))

const LEGAL_LABEL: Record<string, string> = { legalName: 'nombre o razón social', taxId: 'NIT o cédula', address: 'dirección', phone: 'teléfono' }

export function launchChecks(env: Env = process.env, legal: Record<string, string> = LEGAL_ENTITY): LaunchCheck[] {
  const checks: LaunchCheck[] = []
  const add = (group: LaunchCheck['group'], label: string, status: CheckStatus, detail: string) => checks.push({ group, label, status, detail })

  // ── Pagos
  const wompi = wompiSetup(env)
  if (wompi.mode === 'produccion') add('Pagos', 'Wompi en producción', 'ok', 'Las cuatro llaves son de producción: los pagos son reales.')
  else if (wompi.mode === 'pruebas') add('Pagos', 'Wompi en modo de pruebas', 'aviso', 'Las llaves son de sandbox: no se cobra dinero real. Para vender, pon las cuatro llaves de producción en Cloudflare Pages (entorno Production) y vuelve a desplegar.')
  else add('Pagos', 'Wompi mal configurado', 'falta', wompi.problems.join(' '))

  // ── Correos
  const from = env.EMAIL_FROM?.trim() || RESEND_TEST_FROM
  if (!has(env, 'RESEND_API_KEY')) add('Correos', 'Envío de correos', 'falta', 'Falta RESEND_API_KEY: no sale ningún correo.')
  else if (/@resend\.dev>?$/i.test(from)) add('Correos', 'Remitente de los correos', 'falta', `Se envía desde ${from}, la dirección de prueba de Resend, que solo entrega a tu propio correo. Pon EMAIL_FROM (por ejemplo "Pixia <hola@pixiaa.com>").`)
  else add('Correos', 'Remitente de los correos', 'ok', `Se envía desde ${from}.`)
  if (has(env, 'ALERT_EMAIL') || has(env, 'ADMIN_EMAILS')) add('Correos', 'Avisos internos', 'ok', `Los avisos al equipo (PQR, pagos anulados o dobles) llegan a ${has(env, 'ALERT_EMAIL') ? 'ALERT_EMAIL' : 'ADMIN_EMAILS'}.`)
  else add('Correos', 'Avisos internos', 'falta', 'Falta ALERT_EMAIL (o ADMIN_EMAILS): los avisos al equipo no tienen a quién llegar.')
  if (has(env, 'EMAIL_SUPPORT')) add('Correos', 'Correo de soporte', 'ok', `Los clientes responden a ${env.EMAIL_SUPPORT!.trim()}.`)
  else add('Correos', 'Correo de soporte', 'aviso', 'Sin EMAIL_SUPPORT se muestra soporte@pixiaa.com. Confirma que esa bandeja existe y alguien la lee.')

  // ── Datos legales
  const pending = Object.entries(legal).filter(([, v]) => typeof v === 'string' && isPlaceholder(v)).map(([k]) => LEGAL_LABEL[k] ?? k)
  if (pending.length === 0) add('Datos legales', 'Datos del vendedor', 'ok', 'Términos, privacidad y pie de página muestran los datos del RUT.')
  else add('Datos legales', 'Datos del vendedor', 'falta', `Faltan en lib/legal.ts: ${pending.join(', ')}. La ley exige mostrarlos antes de vender (Ley 1480 de 2011, art. 50).`)

  // ── Fotos y PDF
  const r2 = missing(env, ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'NEXT_PUBLIC_R2_PUBLIC_URL'])
  add('Fotos y PDF', 'Almacenamiento de fotos', r2.length ? 'falta' : 'ok', r2.length ? `Faltan: ${r2.join(', ')}. Sin esto no se pueden subir fotos.` : 'Las credenciales del almacenamiento están puestas.')
  const pdf = missing(env, ['PDF_CONTAINER_URL', 'PDF_CONTAINER_SECRET'])
  add('Fotos y PDF', 'Conexión con el generador de PDF', pdf.length ? 'falta' : 'ok', pdf.length ? `Faltan: ${pdf.join(', ')}. Sin esto el admin no puede descargar ni regenerar los PDF.` : 'El admin puede descargar y regenerar los PDF.')

  // ── Admin
  const access = missing(env, ['CF_ACCESS_TEAM_DOMAIN', 'ADMIN_EMAILS'])
  if (access.length) add('Admin', 'Acceso al admin', 'falta', `Faltan: ${access.join(', ')}. Sin esto nadie entra al admin en producción.`)
  else if (!has(env, 'CF_ACCESS_AUD')) add('Admin', 'Acceso al admin', 'aviso', 'Funciona, pero falta CF_ACCESS_AUD: con él solo vale el acceso de la aplicación «Pixia Admin» y no el de otra aplicación del mismo equipo de Cloudflare.')
  else add('Admin', 'Acceso al admin', 'ok', 'Solo entran los correos de ADMIN_EMAILS, por la aplicación «Pixia Admin».')

  // ── Sitio
  const site = env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!site) add('Sitio', 'Dirección del sitio', 'aviso', 'Sin NEXT_PUBLIC_SITE_URL los enlaces de los correos usan https://pixiaa.com.')
  else if (!/^https:\/\//.test(site)) add('Sitio', 'Dirección del sitio', 'falta', `NEXT_PUBLIC_SITE_URL es ${site}: tiene que empezar por https://.`)
  else add('Sitio', 'Dirección del sitio', 'ok', `Los enlaces de los correos llevan a ${site}.`)
  const supa = missing(env, ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
  add('Sitio', 'Base de datos y cuentas', supa.length ? 'falta' : 'ok', supa.length ? `Faltan: ${supa.join(', ')}.` : 'Las credenciales de Supabase están puestas.')

  return checks
}

/** Lo que la web no puede comprobar por sí sola: se revisa a mano, una vez. */
export const MANUAL_STEPS: { where: string; title: string; detail: string }[] = [
  {
    where: 'Wompi',
    title: 'URL de eventos de la cuenta de producción',
    detail: 'En el panel de Wompi, ambiente de producción → Desarrolladores → URL de eventos: https://pixiaa.com/api/orders/webhook. Sandbox y producción se configuran por separado. Si falta, el cliente paga y el pedido se queda «pendiente»; Wompi solo reintenta tres veces (a los 30 minutos, a las 3 horas y a las 24 horas).',
  },
  {
    where: 'Cloudflare',
    title: 'Quitar la protección del sitio y dejar solo la del admin',
    detail: 'En Zero Trust → Access → Applications, la aplicación «Pixia Admin» tiene que cubrir pixiaa.com/admin y pixiaa.com/api/admin. La que cubre todo el sitio se borra el día del lanzamiento. Después, abre pixiaa.com en una ventana privada: debe cargar sin pedir acceso, y pixiaa.com/admin debe pedirlo.',
  },
  {
    where: 'Supabase',
    title: 'Correos de acceso en español y direcciones del sitio',
    detail: 'Authentication → Email Templates: «Confirm signup» y «Magic Link» en español. Authentication → URL Configuration: Site URL https://pixiaa.com y, en Redirect URLs, https://pixiaa.com/auth/callback. SMTP propio (Resend) activado: con el de Supabase los correos solo llegan a los miembros del proyecto.',
  },
  {
    where: 'Google Cloud',
    title: 'Generador de PDF al día',
    detail: 'Última versión desplegada, STORAGE_CLEANUP_MODE=aplicada y ALERT_EMAIL puestos en el servicio pixia-pdf-render. En /admin/almacenamiento se ve si la limpieza diaria está corriendo.',
  },
  {
    where: 'Correo',
    title: 'La bandeja de soporte recibe y responde',
    detail: 'Envía un correo a soporte@pixiaa.com desde una cuenta personal y respóndelo. Es la dirección que aparece en los términos, en los correos y en las PQR.',
  },
  {
    where: 'Prueba final',
    title: 'Una compra real de punta a punta',
    detail: 'Con las llaves de producción puestas: crea un álbum, págalo con tu tarjeta, confirma el correo, el pedido en /admin con su PDF y el álbum como «Pedido» en Mis álbumes. Después devuelve el pago desde Wompi.',
  },
  {
    where: 'Fuera de la web',
    title: 'Imprenta, abogado y fotos',
    detail: 'Prueba física de los tres tamaños con Range (y su confirmación de garantía, mínimo de páginas y empaque), revisión de términos y privacidad por el abogado, y fotos reales del producto.',
  },
]
