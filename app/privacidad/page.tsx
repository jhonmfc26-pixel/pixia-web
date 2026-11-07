import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDoc, Section, List, Strong, EntityBlock } from '@/components/legal/LegalDoc'
import { LEGAL_ENTITY, SIC_URL, TERMS_UPDATED_LABEL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Política de tratamiento de datos personales',
  description: 'Cómo Pixia recoge, usa, protege y comparte tus datos personales y tus fotos, y cómo ejercer tus derechos (Ley 1581 de 2012).',
  alternates: { canonical: '/privacidad' },
}

const TOC = [
  { id: 'responsable', label: 'Responsable del tratamiento' },
  { id: 'datos', label: 'Qué datos tratamos' },
  { id: 'finalidades', label: 'Para qué los usamos' },
  { id: 'fotos-menores', label: 'Fotos, datos sensibles y menores de edad' },
  { id: 'autorizacion', label: 'Autorización' },
  { id: 'terceros', label: 'Con quién los compartimos' },
  { id: 'conservacion', label: 'Cuánto tiempo los guardamos' },
  { id: 'derechos', label: 'Tus derechos' },
  { id: 'procedimiento', label: 'Cómo ejercer tus derechos' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'cookies', label: 'Cookies y almacenamiento del navegador' },
  { id: 'vigencia', label: 'Vigencia y cambios' },
]

export default function PrivacidadPage() {
  const email = LEGAL_ENTITY.email
  return (
    <LegalDoc
      title="Política de tratamiento de datos personales"
      toc={TOC}
      intro={
        <p>
          En Pixia trabajamos con algo muy personal: tus fotos y tus recuerdos. Esta política explica, conforme a la Ley 1581 de 2012 y al Decreto 1377 de 2013
          (compilado en el Decreto 1074 de 2015), qué datos recogemos, para qué, con quién los compartimos y cómo puedes conocerlos, corregirlos o pedir que los borremos.
          <Strong> No vendemos tus datos ni usamos tus fotos para publicidad.</Strong>
        </p>
      }
    >
      <Section id="responsable" n={1} title="Responsable del tratamiento">
        <EntityBlock />
        <p>Las solicitudes sobre datos personales las atiende el equipo de soporte en <a className="underline" href={`mailto:${email}`}>{email}</a>.</p>
      </Section>

      <Section id="datos" n={2} title="Qué datos tratamos">
        <List items={[
          <><Strong>Identificación y contacto:</Strong> nombre, correo electrónico y teléfono.</>,
          <><Strong>Entrega:</Strong> dirección, ciudad, departamento, código postal e indicaciones de envío.</>,
          <><Strong>Contenido del álbum:</Strong> las fotos que subes (incluida la información que traen, como la fecha en que se tomaron), los textos de la portada y el diseño.</>,
          <><Strong>Pedido y pago:</Strong> número de orden, valor, estado, medio de pago y la referencia de la transacción. Los datos de tu tarjeta los recibe directamente la pasarela de pagos (Wompi); Pixia no los conoce ni los guarda.</>,
          <><Strong>Técnicos:</Strong> la dirección IP, la fecha y la hora en que aceptas los términos (como prueba de la aceptación) y datos básicos del navegador necesarios para que el sitio funcione.</>,
          <><Strong>Comunicaciones:</Strong> lo que nos escribes cuando pides soporte o presentas una petición, queja o reclamo.</>,
        ]} />
      </Section>

      <Section id="finalidades" n={3} title="Para qué los usamos">
        <List items={[
          'Crear, guardar y mostrarte tu álbum, y permitirte volver a verlo desde Mis álbumes.',
          'Procesar el pago y prevenir fraudes.',
          'Imprimir el álbum y enviarlo a la dirección que indiques.',
          'Avisarte del estado de tu pedido (confirmación, impresión, envío y entrega).',
          'Emitir la factura y cumplir obligaciones contables, tributarias y legales.',
          'Atender tus solicitudes, garantías, peticiones, quejas y reclamos.',
          'Mejorar el servicio con estadísticas agregadas que no te identifican.',
        ]} />
        <p>Solo te enviaremos mensajes publicitarios si nos das una autorización aparte para eso, que podrás retirar cuando quieras.</p>
      </Section>

      <Section id="fotos-menores" n={4} title="Fotos, datos sensibles y menores de edad">
        <p>
          Tus fotos pueden mostrar a otras personas, y algunas imágenes pueden revelar información sensible. Usamos las fotos <Strong>solo para diseñar, mostrar e imprimir tu álbum</Strong>.
          Podemos analizarlas de forma automática (nitidez, encuadre, orientación, fecha) para proponer el diseño, pero <Strong>no las usamos para identificar a las personas</Strong> ni para
          entrenar modelos de terceros.
        </p>
        <p>
          Si en tus fotos aparecen niñas, niños o adolescentes, al subirlas declaras que eres su representante legal o que cuentas con la autorización de este. Trataremos esas
          imágenes respetando su interés superior y solo para la finalidad del álbum. No está permitido usar Pixia para crear álbumes de menores sin esa autorización.
        </p>
        <p>Nadie está obligado a entregarnos datos sensibles; sin embargo, sin las fotos no es posible fabricar el álbum.</p>
      </Section>

      <Section id="autorizacion" n={5} title="Autorización">
        <p>
          Nos autorizas a tratar tus datos para estas finalidades cuando creas un álbum, inicias sesión o haces un pedido y aceptas esta política. Guardamos la prueba de esa
          autorización. Puedes revocarla o pedir la supresión de tus datos en cualquier momento (ver “Cómo ejercer tus derechos”), salvo cuando tengamos el deber legal o
          contractual de conservarlos, por ejemplo mientras haya un pedido en curso o por las normas contables.
        </p>
      </Section>

      <Section id="terceros" n={6} title="Con quién los compartimos">
        <p>Compartimos tus datos solo con proveedores que nos ayudan a prestar el servicio (encargados del tratamiento), y solo los datos que cada uno necesita:</p>
        <List items={[
          <><Strong>Supabase</Strong> — base de datos y acceso a tu cuenta (servidores en Estados Unidos).</>,
          <><Strong>Cloudflare</Strong> — alojamiento del sitio y almacenamiento de las fotos y los archivos de impresión (red global).</>,
          <><Strong>Google Cloud</Strong> — generación del archivo de impresión de tu álbum (Estados Unidos).</>,
          <><Strong>Resend</Strong> — envío de los correos del pedido (Estados Unidos).</>,
          <><Strong>Wompi</Strong> — procesamiento del pago (Colombia).</>,
          <><Strong>La imprenta aliada y la transportadora</Strong> — el archivo del álbum, y tu nombre, teléfono y dirección para la entrega (Colombia).</>,
        ]} />
        <p>
          Algunos de estos proveedores están fuera de Colombia, por lo que tus datos pueden transmitirse a otros países. Lo hacemos con proveedores que ofrecen niveles adecuados de
          protección y les exigimos usar los datos solo para prestarnos el servicio y protegerlos. También entregaremos datos a una autoridad cuando una norma o una orden lo exija.
        </p>
      </Section>

      <Section id="conservacion" n={7} title="Cuánto tiempo los guardamos">
        <List items={[
          'Tu cuenta, tus fotos y tus álbumes: mientras tu cuenta esté activa, para que puedas volver a verlos, o hasta que nos pidas borrarlos.',
          'El archivo de impresión de un pedido: durante el periodo de garantía, para poder reimprimir si hace falta.',
          'Los datos del pedido y la facturación: durante el tiempo que exigen las normas contables, tributarias y comerciales.',
          'Las solicitudes de soporte y PQR: durante el tiempo necesario para atenderlas y demostrar que las atendimos.',
        ]} />
      </Section>

      <Section id="derechos" n={8} title="Tus derechos">
        <p>Como titular de los datos tienes derecho a (artículo 8 de la Ley 1581 de 2012):</p>
        <List items={[
          'Conocer, actualizar y rectificar tus datos.',
          'Pedir prueba de la autorización que nos diste.',
          'Ser informado sobre el uso que les damos.',
          'Revocar la autorización y/o pedir que los borremos, cuando no exista un deber legal o contractual de conservarlos.',
          'Acceder gratis a tus datos.',
          <>Presentar quejas ante la Superintendencia de Industria y Comercio (<a className="underline" href={SIC_URL} target="_blank" rel="noreferrer">www.sic.gov.co</a>) después de haber hecho tu consulta o reclamo ante nosotros.</>,
        ]} />
      </Section>

      <Section id="procedimiento" n={9} title="Cómo ejercer tus derechos">
        <p>
          Radica tu consulta o reclamo en <Link className="underline" href="/soporte?tipo=datos_consulta">pixiaa.com/soporte</Link> (o escríbenos a <a className="underline" href={`mailto:${email}`}>{email}</a>) desde el correo de tu cuenta (o demostrando que eres el titular o su representante), indicando
          qué necesitas. Te confirmamos el recibo con un número de radicado.
        </p>
        <List items={[
          <><Strong>Consultas</Strong> (saber qué datos tenemos y cómo los usamos): respondemos en máximo 10 días hábiles. Si no es posible, te explicamos el motivo y te respondemos en máximo 5 días hábiles más.</>,
          <><Strong>Reclamos</Strong> (corregir, actualizar o borrar datos, revocar la autorización o reportar un incumplimiento): respondemos en máximo 15 días hábiles. Si no es posible, te explicamos el motivo y te respondemos en máximo 8 días hábiles más. Si el reclamo está incompleto te pediremos lo que falta dentro de los 5 días siguientes; si pasan 2 meses sin que lo completes, entenderemos que desististe.</>,
        ]} />
      </Section>

      <Section id="seguridad" n={10} title="Seguridad">
        <p>
          Protegemos tus datos con conexiones cifradas (HTTPS), control de acceso a la información, almacenamiento privado de los archivos de impresión y acceso restringido al
          personal que lo necesita. Ningún sistema es infalible: si ocurre un incidente que afecte tus datos te avisaremos y lo reportaremos a la autoridad según la ley.
        </p>
      </Section>

      <Section id="cookies" n={11} title="Cookies y almacenamiento del navegador">
        <p>
          Usamos el almacenamiento de tu navegador (cookies, localStorage e IndexedDB) solo para que el sitio funcione: mantener tu sesión y guardar el álbum mientras lo creas.
          No usamos cookies de publicidad de terceros. Si borras estos datos del navegador, perderás los borradores que no hayas guardado en tu cuenta.
        </p>
      </Section>

      <Section id="vigencia" n={12} title="Vigencia y cambios">
        <p>
          Esta política rige desde el {TERMS_UPDATED_LABEL}. Las bases de datos se mantendrán mientras exista la finalidad para la que se recogieron los datos. Si hacemos cambios
          importantes te lo informaremos antes de aplicarlos. Consulta también los <Link className="underline" href="/terminos">Términos y condiciones</Link>.
        </p>
      </Section>
    </LegalDoc>
  )
}
