import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDoc, Section, List, Strong, EntityBlock } from '@/components/legal/LegalDoc'
import { COMMERCIAL, LEGAL_ENTITY, SIC_URL } from '@/lib/legal'
import { PRICING } from '@/lib/wompi'

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de uso y de compra de los álbumes impresos de Pixia: precio, entrega, cancelación, garantía y reclamos.',
  alternates: { canonical: '/terminos' },
}

const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const TOC = [
  { id: 'quienes-somos', label: 'Quiénes somos' },
  { id: 'aceptacion', label: 'Aceptación de estos términos' },
  { id: 'servicio', label: 'Cómo funciona el servicio' },
  { id: 'aprobacion', label: 'Revisión y aprobación del álbum' },
  { id: 'precio', label: 'Precio, pago y factura' },
  { id: 'entrega', label: 'Producción y entrega' },
  { id: 'cancelacion', label: 'Cancelación y derecho de retracto' },
  { id: 'garantia', label: 'Garantía' },
  { id: 'reversion', label: 'Reversión del pago' },
  { id: 'fotos', label: 'Tus fotos y la propiedad intelectual' },
  { id: 'cuenta', label: 'Tu cuenta' },
  { id: 'responsabilidad', label: 'Alcance de nuestra responsabilidad' },
  { id: 'datos', label: 'Datos personales' },
  { id: 'pqr', label: 'Peticiones, quejas y reclamos' },
  { id: 'cambios', label: 'Cambios a estos términos' },
  { id: 'ley', label: 'Ley aplicable' },
]

export default function TerminosPage() {
  const email = LEGAL_ENTITY.email
  return (
    <LegalDoc
      title="Términos y condiciones"
      toc={TOC}
      intro={
        <>
          <p>
            Estas son las reglas para usar Pixia y comprar tu álbum. Las escribimos en lenguaje claro para que siempre sepas qué
            estás comprando, qué puedes esperar y qué hacer si algo sale mal.
          </p>
          <div className="mt-6 rounded-2xl border border-[rgba(232,85,58,0.25)] bg-[rgba(232,85,58,0.06)] p-5">
            <p className="mb-3 text-sm font-medium text-white">Lo esencial, en 30 segundos</p>
            <List items={[
              <>Pixia diseña con tus fotos un álbum <Strong>impreso de tapa dura de 30 × 30 cm</Strong> y te lo envía a casa.</>,
              <>Antes de pagar <Strong>revisas y apruebas</Strong> la vista previa. Se imprime exactamente lo que apruebas: <Strong>después de pagar el álbum ya no se puede editar</Strong>.</>,
              <>Por ser un producto personalizado no aplica el derecho de retracto, pero <Strong>puedes cancelar con devolución total mientras tu pedido no haya entrado a impresión</Strong>.</>,
              <>Si llega con un defecto de impresión o encuadernación, o dañado por el transporte, <Strong>lo reimprimimos sin costo o te devolvemos el dinero</Strong>.</>,
              <>Entregamos en {COMMERCIAL.coverage} en <Strong>{COMMERCIAL.deliveryLabel}</Strong> y te avisamos por correo en cada paso.</>,
            ]} />
          </div>
        </>
      }
    >
      <Section id="quienes-somos" n={1} title="Quiénes somos">
        <p>El servicio Pixia (el sitio {LEGAL_ENTITY.website.replace('https://', '')}) es ofrecido por:</p>
        <EntityBlock />
        <p>En estos términos, “Pixia”, “nosotros” o “nuestro” se refiere a este titular. “Tú” o “el cliente” es la persona que usa el sitio o compra un álbum.</p>
      </Section>

      <Section id="aceptacion" n={2} title="Aceptación de estos términos">
        <p>
          Al crear un álbum o hacer un pedido aceptas estos términos y la <Link className="underline" href="/privacidad">Política de tratamiento de datos personales</Link>.
          En el momento de pagar te pedimos aceptarlos de forma expresa; guardamos la fecha, la hora y la versión que aceptaste como constancia
          (esta aceptación electrónica es válida según la Ley 527 de 1999).
        </p>
        <p>Para comprar debes ser mayor de 18 años y tener capacidad legal para contratar.</p>
      </Section>

      <Section id="servicio" n={3} title="Cómo funciona el servicio">
        <List items={[
          <>Subes tus fotos y eliges el tipo de historia. Pixia las ordena y propone un diseño página por página usando herramientas automáticas (incluida inteligencia artificial). Puedes cambiar el diseño, el orden, la portada y los textos antes de pagar.</>,
          <><Strong>La vista previa es una representación digital.</Strong> Los colores en pantalla dependen del brillo y la calibración de cada dispositivo, por lo que el impreso puede verse ligeramente distinto. Los bordes de cada página tienen una pequeña zona de corte, por lo que una franja muy delgada del borde de las fotos a página completa puede quedar fuera.</>,
          <>Si una foto tiene baja resolución te lo advertimos cuando sea posible; si decides usarla, puede verse borrosa o pixelada en el impreso.</>,
          <>Los textos (título, nombres, fechas) se imprimen tal como los escribes. Revisa la ortografía antes de aprobar.</>,
        ]} />
      </Section>

      <Section id="aprobacion" n={4} title="Revisión y aprobación del álbum">
        <p>
          Antes de pagar te mostramos el álbum completo y un resumen del pedido (páginas, precio total y dirección de entrega) para que puedas corregir cualquier
          error. Al marcar la casilla de revisión y pagar, <Strong>apruebas el contenido y el diseño</Strong> del álbum.
        </p>
        <p>
          Desde ese momento el álbum queda congelado: es el archivo que enviamos a imprenta. Lo podrás seguir viendo y compartiendo desde
          <Link className="underline" href="/mis-albumes"> Mis álbumes</Link>, pero no editarlo. Si quieres cambios, hazlos antes de pagar o crea un álbum nuevo.
        </p>
      </Section>

      <Section id="precio" n={5} title="Precio, pago y factura">
        <List items={[
          <>Los precios están en pesos colombianos e <Strong>incluyen los impuestos aplicables</Strong>. El precio total se muestra antes de pagar y es el único que se cobra.</>,
          <>El precio base es de <Strong>{cop(PRICING.basePriceCop)}</Strong> e incluye hasta {PRICING.pagesIncluded} páginas. Cada página adicional cuesta {cop(PRICING.extraPagePriceCop)}. {PRICING.shippingCop === 0 ? <>El envío está <Strong>incluido</Strong>.</> : <>El envío cuesta {cop(PRICING.shippingCop)}.</>}</>,
          <>Los pagos se procesan a través de Wompi (tarjeta, PSE, Nequi y los demás medios que muestre la pasarela). Pixia no recibe ni guarda los datos de tu tarjeta.</>,
          <>El pedido se confirma cuando la pasarela aprueba el pago; te enviamos un correo con el número de orden y el resumen.</>,
          <>Te enviamos la factura electrónica al correo que registraste.</>,
          <>Podemos cambiar los precios en cualquier momento, pero se respeta el precio que aceptaste al pagar.</>,
        ]} />
      </Section>

      <Section id="entrega" n={6} title="Producción y entrega">
        <List items={[
          <>Enviamos a {COMMERCIAL.coverage}. El plazo de entrega es de <Strong>{COMMERCIAL.deliveryLabel}</Strong> contados desde la confirmación del pago, salvo que al comprar te informemos otro.</>,
          <>Te avisamos por correo cuando tu álbum entra a impresión, cuando sale (con la transportadora y el número de guía) y cuando se entrega. También puedes ver el estado en tu álbum.</>,
          <>Revisa que la dirección sea correcta y completa. Si el envío no se puede entregar por una dirección errada o porque nadie lo recibe después de los intentos de la transportadora, coordinaremos contigo un nuevo envío; en ese caso el costo del reenvío corre por tu cuenta.</>,
          <>Si no cumplimos el plazo, puedes terminar la compra y te devolvemos todo lo pagado en máximo {COMMERCIAL.refundCalendarDays} días calendario, o esperar el álbum si lo prefieres.</>,
        ]} />
      </Section>

      <Section id="cancelacion" n={7} title="Cancelación y derecho de retracto">
        <p>
          El derecho de retracto del artículo 47 de la Ley 1480 de 2011 (Estatuto del Consumidor) <Strong>no aplica</Strong> a los álbumes Pixia, porque la ley lo
          excluye para los bienes confeccionados conforme a las especificaciones del consumidor o claramente personalizados: cada álbum se fabrica con tus fotos y tu diseño y
          no se puede vender a nadie más.
        </p>
        <p>
          Aun así, <Strong>puedes cancelar tu pedido y recibir la devolución total</Strong> mientras no haya entrado a impresión (el estado lo ves en tu álbum y en los correos).
          Escríbenos a <a className="underline" href={`mailto:${email}`}>{email}</a> con tu número de orden. Devolvemos el dinero por el mismo medio de pago en máximo {COMMERCIAL.refundCalendarDays} días calendario.
          Una vez que el álbum entra a impresión ya no es posible cancelarlo.
        </p>
      </Section>

      <Section id="garantia" n={8} title="Garantía">
        <p>
          Tu álbum tiene la garantía legal de calidad e idoneidad del Estatuto del Consumidor. Pixia responde durante <Strong>{COMMERCIAL.warrantyMonths} meses desde la entrega</Strong> por
          defectos de fabricación, por ejemplo:
        </p>
        <List items={[
          'Fallas de impresión: rayas, manchas, páginas en blanco o colores notoriamente distintos del archivo aprobado (más allá de la variación normal entre pantalla e impreso).',
          'Fallas de encuadernación o materiales: hojas que se sueltan, tapa despegada o páginas en desorden respecto al archivo aprobado.',
          <>Daños del transporte (tapa golpeada, humedad, empaque roto): repórtalos dentro de los <Strong>{COMMERCIAL.transportDamageBusinessDays} días hábiles</Strong> siguientes a la entrega, con fotos del álbum y del empaque.</>,
        ]} />
        <p>
          <Strong>Cómo la hacemos efectiva:</Strong> escríbenos a <a className="underline" href={`mailto:${email}`}>{email}</a> con tu número de orden y fotos del defecto. Te respondemos
          en máximo {COMMERCIAL.pqrResponseBusinessDays} días hábiles. Si procede, <Strong>reimprimimos y te enviamos el álbum sin ningún costo</Strong>; si la reimpresión no es posible,
          te devolvemos el dinero. No es necesario que nos devuelvas el álbum defectuoso salvo que te lo pidamos (en ese caso, el envío corre por nuestra cuenta).
        </p>
        <p><Strong>No cubre</Strong>, porque no son defectos de fabricación:</p>
        <List items={[
          'Lo que estaba en la vista previa que aprobaste: errores de ortografía, fotos elegidas, orden, recortes o diseño.',
          'La baja calidad propia de una foto (desenfocada, oscura o de baja resolución).',
          'Variaciones leves de color entre la pantalla y el papel.',
          'El desgaste por uso o los daños por mal manejo, humedad, calor o exposición prolongada al sol después de la entrega.',
        ]} />
      </Section>

      <Section id="reversion" n={9} title="Reversión del pago">
        <p>
          Si pagaste con tarjeta u otro instrumento electrónico, puedes pedir la reversión del pago (artículo 51 de la Ley 1480 de 2011 y Decreto 1074 de 2015) cuando
          hayas sido víctima de fraude, la operación no haya sido solicitada por ti, no hayas recibido el álbum, o el álbum no corresponda a lo que aprobaste o sea defectuoso.
        </p>
        <p>
          Debes presentar la queja dentro de los <Strong>5 días hábiles</Strong> siguientes a la fecha en que conociste el fraude o la operación no solicitada, o en que debiste
          recibir el álbum o lo recibiste defectuoso o distinto. Preséntala a Pixia (<a className="underline" href={`mailto:${email}`}>{email}</a>) indicando la causal y que el álbum queda
          a nuestra disposición, y notifica también al emisor de tu tarjeta o medio de pago. Te confirmamos el recibo de la queja.
        </p>
      </Section>

      <Section id="fotos" n={10} title="Tus fotos y la propiedad intelectual">
        <List items={[
          <><Strong>Tus fotos son tuyas.</Strong> Nos das un permiso limitado para guardarlas, procesarlas, diseñar e imprimir tu álbum y mostrártelo; no las usamos para publicidad ni las compartimos con nadie distinto a quienes nos ayudan a prestar el servicio (ver la política de datos), salvo que nos des una autorización aparte.</>,
          <>Declaras que tienes derecho a usar las fotos y textos que subes y que cuentas con la autorización de las personas que aparecen en ellas. Si aparecen niñas, niños o adolescentes, declaras que eres su representante legal o que cuentas con su autorización.</>,
          <>No está permitido subir contenido ilegal, que vulnere derechos de terceros (por ejemplo, de autor o de imagen), sexual que involucre a menores de edad, o que incite a la violencia o la discriminación. Si detectamos un contenido así podemos no imprimir el pedido y devolver el dinero, y daremos aviso a las autoridades cuando la ley lo exija.</>,
          <>La marca Pixia, el sitio, el software y los diseños de las plantillas son de Pixia y están protegidos por las normas de propiedad intelectual.</>,
          <>Guarda siempre una copia de tus fotos originales: Pixia no es un servicio de respaldo.</>,
        ]} />
      </Section>

      <Section id="cuenta" n={11} title="Tu cuenta">
        <p>
          Entras a Pixia con un enlace que te enviamos al correo. Mantén segura tu cuenta de correo: quien tenga acceso a ella podrá ver tus álbumes. Avísanos si crees que alguien
          entró sin tu permiso.
        </p>
      </Section>

      <Section id="responsabilidad" n={12} title="Alcance de nuestra responsabilidad">
        <p>
          Respondemos por la calidad del álbum y por cumplir lo que ofrecemos, en los términos de la ley. No somos responsables por fallas causadas por información incorrecta que nos
          entregues (por ejemplo, una dirección errada) ni por interrupciones del servicio por causas ajenas a nosotros (fuerza mayor, caídas de proveedores de internet o de pago).
          Nada en estos términos limita los derechos que te da el Estatuto del Consumidor.
        </p>
      </Section>

      <Section id="datos" n={13} title="Datos personales">
        <p>
          Tratamos tus datos según la Ley 1581 de 2012. Qué datos recogemos, para qué, con quién los compartimos y cómo ejercer tus derechos está en la
          <Link className="underline" href="/privacidad"> Política de tratamiento de datos personales</Link>.
        </p>
      </Section>

      <Section id="pqr" n={14} title="Peticiones, quejas y reclamos">
        <p>
          Escríbenos a <a className="underline" href={`mailto:${email}`}>{email}</a>{LEGAL_ENTITY.phone.startsWith('[') ? '' : <> o al {LEGAL_ENTITY.phone}</>} con tu nombre, número de orden
          (si lo tienes) y tu solicitud. Te confirmamos el recibo con un <Strong>número de radicado, fecha y hora</Strong> para que puedas hacerle seguimiento, y te respondemos de fondo en
          máximo {COMMERCIAL.pqrResponseBusinessDays} días hábiles.
        </p>
        <p>
          Si no quedas satisfecho con la respuesta, puedes acudir a la Superintendencia de Industria y Comercio (<a className="underline" href={SIC_URL} target="_blank" rel="noreferrer">www.sic.gov.co</a>).
        </p>
      </Section>

      <Section id="cambios" n={15} title="Cambios a estos términos">
        <p>
          Podemos actualizar estos términos. Los cambios aplican a los pedidos hechos después de su publicación; tu pedido se rige por la versión que aceptaste al pagar, que queda
          registrada con el pedido.
        </p>
      </Section>

      <Section id="ley" n={16} title="Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República de Colombia, en especial la Ley 1480 de 2011 (Estatuto del Consumidor) y sus modificaciones, la Ley 527 de 1999,
          el Decreto 1074 de 2015 y la Ley 1581 de 2012. Las controversias se resolverán ante las autoridades colombianas competentes, incluida la Superintendencia de Industria y Comercio.
        </p>
      </Section>
    </LegalDoc>
  )
}
