/**
 * Remitente de los correos de la web. Sin EMAIL_FROM, Resend usa su dirección
 * de prueba (onboarding@resend.dev), que SOLO entrega al correo dueño de la
 * cuenta de Resend: con eso, los correos de los clientes no llegan. El admin
 * muestra un aviso cuando pasa (app/admin/layout.tsx).
 */
export const RESEND_TEST_FROM = 'Pixia <onboarding@resend.dev>'

export function emailFrom(): string {
  // trim: un espacio o salto de línea pegado al copiar el valor no debe romperlo.
  return process.env.EMAIL_FROM?.trim() || RESEND_TEST_FROM
}

/** true cuando los correos salen en modo prueba de Resend. */
export function emailInTestMode(): boolean {
  return /@resend\.dev>?$/i.test(emailFrom())
}
