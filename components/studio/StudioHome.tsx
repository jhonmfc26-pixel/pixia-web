'use client'
/* eslint-disable @next/next/no-img-element -- fotos estáticas en /public, sin optimizador en Cloudflare Pages */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { FORMATS, LOWEST_PRICE_COP, formatCop, type AlbumFormat } from '@/lib/formats'
import { COMMERCIAL } from '@/lib/legal'
import './studio.css'

/**
 * Home "estudio": fondo claro de estudio fotográfico, el álbum como objeto real
 * y escenas guiadas por el scroll (estilo páginas de producto de Apple).
 * Aprobada por Jhon sobre el prototipo (2026-11-08): fondo claro, libro
 * abierto flotando de frente (opción A), foto favorita a doble página.
 *
 * Las animaciones se calculan en cada frame a partir del avance del scroll
 * dentro de cada sección (secciones altas con un escenario "sticky").
 */

const IMG = (name: string) => `/showcase/${name}.jpg`

export default function StudioHome() {
  const root = useRef<HTMLDivElement>(null)
  // El fondo del documento acompaña al de la página (rebote del scroll en iPhone).
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = '#F2F2F0'
    return () => { document.body.style.background = prev }
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    return startScrollScenes(el)
  }, [])

  return (
    <div className="st-root" ref={root}>
      <nav className="st-nav">
        <Link href="/" className="st-logo">
          <img src="/logo-mark.png" alt="" width={24} height={24} />
          Pixia
        </Link>
        <ul>
          <li><a href="#formatos">Formatos</a></li>
          <li><a href="#proceso">Cómo funciona</a></li>
          <li><a href="#detalles">Calidad</a></li>
          <li><a href="#precios">Precios</a></li>
        </ul>
        <div className="st-nav-actions">
          {/* Siempre visible: con sesión lista los álbumes de la cuenta; sin
              sesión, los borradores de este dispositivo o la opción de entrar
              con el correo del pedido / crear el primero. */}
          <Link href="/mis-albumes" className="st-nav-link">Mis álbumes</Link>
          <Link href="/create" className="st-pill">Crear álbum</Link>
        </div>
      </nav>

      {/* 1 · El álbum gira, se abre y se acerca con el scroll */}
      <section id="hero" className="st-scroll">
        <div className="st-stage">
          <div className="st-hero-copy" data-ref="heroCopy">
            <h1>Tus fotos merecen<br />ser un libro.</h1>
            <p className="st-lede">Sube tus fotos y Pixia diseña cada página. Lo recibes en casa, impreso en tapa dura.</p>
            <div className="st-ctas">
              <Link href="/create" className="st-btn primary">Crear mi álbum</Link>
              <a href="#formatos" className="st-btn link">Ver formatos</a>
            </div>
          </div>
          <div className="st-shadow" data-ref="heroShadow" />
          <div className="st-contact" data-ref="heroContact" />
          <div className="st-book" data-ref="heroBook">
            <div className="st-back" />
            <div className="st-edge-t" /><div className="st-edge-b" /><div className="st-edge-r" />
            <div className="st-page-r">
              <div className="st-layout" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1.4fr 1fr' }}>
                <img src={IMG('boda-paseo')} alt="" style={{ gridColumn: '1 / 3', objectPosition: '50% 40%' }} />
                <img src={IMG('aniversario')} alt="" />
                <img src={IMG('recuerdos')} alt="" />
              </div>
            </div>
            <Spine title="Nuestra boda" />
            <div className="st-cover" data-ref="heroCover">
              <div className="st-face st-cover-front">
                <span className="st-grain" />
                <img src={IMG('playa')} alt="Álbum Pixia de boda, tapa dura con foto" style={{ objectPosition: '62% 50%' }} />
                <div className="st-title-on-cover"><b>Nuestra boda</b><span>Laura &amp; Andrés · 2026</span></div>
              </div>
              <div className="st-face st-cover-inside st-cloth">
                <div className="st-page-l"><div className="st-bleed"><img src={IMG('boda-beso')} alt="" style={{ objectPosition: '55% 50%' }} /></div></div>
              </div>
            </div>
          </div>
          <div className="st-caption" data-ref="heroCaption">
            Cada página, diseñada para tu historia.
            <small>Pixia ordena tus fotos por fecha y elige el mejor diseño para cada momento.</small>
          </div>
        </div>
      </section>

      {/* 2 · Los tres formatos a escala real entre ellos */}
      <section id="formatos" className="st-scroll">
        <div className="st-stage">
          <div className="st-sec-head" data-ref="fmtHead">
            <h2>Un tamaño para cada historia.</h2>
            <p>Tres formatos en tapa dura. Pixia te sugiere el ideal según tu momento, y puedes cambiarlo.</p>
          </div>
          <div className="st-shelf">
            {FORMATS.map(f => <FormatSlot key={f.id} format={f} />)}
          </div>
        </div>
      </section>

      {/* 3 · De tus fotos a tu libro, y la favorita a doble página */}
      <section id="proceso" className="st-scroll">
        <div className="st-stage" data-ref="procStage">
          <div className="st-sec-head" data-ref="procHead">
            <h2>De tus fotos a tu libro.</h2>
            <p>Sube las fotos de tu celular. Pixia las ordena por fecha, elige las mejores y arma cada página.</p>
          </div>
          <div className="st-sec-head swap" data-ref="procHead2">
            <h2>Tu foto favorita, de lado a lado.</h2>
            <p>Márcala con una estrella y Pixia la lleva a doble página, cruzando el lomo del álbum.</p>
          </div>
          <div className="st-spread" data-ref="spread" />
          {PROCESS_PHOTOS.map((n, i) => (
            <div key={i} className="st-print" data-print={i}>
              <img src={IMG(n)} alt="" />
              {i === 0 && <span className="st-star" data-ref="star" aria-hidden>★</span>}
            </div>
          ))}
          <div className="st-gutter" data-ref="gutter" />
        </div>
      </section>

      {/* 4 · Calidad: acercamiento a la tapa y el lomo */}
      <section id="detalles" className="st-scroll">
        <div className="st-stage">
          <div className="st-detail-lines">
            <h2 data-line>Tapa dura con tu foto en la portada.</h2>
            <h2 data-line>Papel grueso, colores que duran.</h2>
            <h2 data-line>Hecho en Colombia, en tu casa en días.</h2>
          </div>
          <div className="st-book" data-ref="detBook">
            <div className="st-back" /><div className="st-edge-t" /><div className="st-edge-b" /><div className="st-edge-r" />
            <div className="st-page-r" /><Spine title="Nuestra boda" />
            <div className="st-cover">
              <div className="st-face st-cover-front">
                <span className="st-grain" />
                <img src={IMG('boda-beso')} alt="" style={{ objectPosition: '50% 35%' }} />
                <div className="st-title-on-cover"><b>Nuestra boda</b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="st-steps" id="como-funciona">
        <div className="st-wrap">
          <h2>Tres pasos. Unos minutos.</h2>
          <ol>
            <li><b>Elige tu momento</b><p>Boda, viaje, tu bebé. Pixia te sugiere el formato ideal.</p></li>
            <li><b>Sube tus fotos</b><p>Desde el celular o el computador. Marca con una estrella tus favoritas.</p></li>
            <li><b>Revisa y pide</b><p>Ajusta lo que quieras y recíbelo en casa en tapa dura.</p></li>
          </ol>
        </div>
      </section>

      <section className="st-final" id="precios">
        <h2>Tu próximo álbum empieza<br />con una foto.</h2>
        <p>
          Desde {formatCop(LOWEST_PRICE_COP)}. Envío gratis a toda Colombia. Garantía de {COMMERCIAL.warrantyDays} días.
        </p>
        <div className="st-ctas"><Link href="/create" className="st-btn primary">Crear mi álbum</Link></div>
      </section>
    </div>
  )
}

/** Un álbum del estante de formatos. Las medidas reales las pone el motor de scroll. */
function FormatSlot({ format: f }: { format: AlbumFormat }) {
  return (
    <div className="st-slot" data-wcm={f.widthCm} data-hcm={f.heightCm}>
      <div className="st-holder">
        <div className="st-floor" />
        <div className="st-book">
          <div className="st-back" />
          <div className="st-edge-t" /><div className="st-edge-b" /><div className="st-edge-r" />
          <div className="st-spine" />
          <div className="st-cover">
            <div className="st-face st-cover-front">
              <span className="st-grain" />
              {f.id === '30x30' && <>
                <img src={IMG('boda-paseo')} alt="Álbum grande 30 × 30 de boda" style={{ objectPosition: '50% 40%' }} />
                <div className="st-title-on-cover"><b>Laura &amp; Andrés</b></div>
              </>}
              {f.id === '20x20' && (
                <div className="st-kids">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <circle cx="72" cy="28" r="11" fill="#F7B267" />
                    <path d="M10 40 q6 -8 14 -2 q6 -7 13 0 q7 1 5 7 h-34 q-4 -3 2 -5z" fill="#fff" opacity=".9" />
                    <path d="M0 78 Q25 64 50 74 T100 70 V100 H0z" fill="#E8B8A3" />
                    <path d="M0 86 Q30 76 60 84 T100 82 V100 H0z" fill="#D9A08A" />
                  </svg>
                  <div className="st-t"><b>Mi primer año</b><span>Sofía</span></div>
                </div>
              )}
              {f.id === '21x28' && <>
                <img src={IMG('viaje-carretera')} alt="Álbum vertical 21 × 28 de viaje" style={{ objectPosition: '70% 50%' }} />
                <div className="st-title-on-cover"><b>Ruta al desierto</b><span>Agosto 2026</span></div>
              </>}
            </div>
          </div>
        </div>
      </div>
      <div className="st-meta">
        <b>{f.name}</b>
        <span>{f.sizeLabel} · {f.use}</span>
        {f.available
          ? <em>{formatCop(f.priceCop)}</em>
          : <em className="soon">{formatCop(f.priceCop)} · Muy pronto</em>}
      </div>
    </div>
  )
}

/**
 * Lomo impreso (mismo material de la cubierta) con el título del álbum (de arriba hacia abajo, como los
 * libros en español) y la marca Pixia al pie. Todo escala con el grosor del
 * libro (--t).
 */
function Spine({ title, style }: { title: string; style?: React.CSSProperties }) {
  return (
    <div className="st-spine" style={style}>
      <span className="st-spine-title">{title}</span>
      <img className="st-spine-logo" src="/logo-mark.png" alt="" />
    </div>
  )
}

const PROCESS_PHOTOS = ['playa', 'boda-paseo', 'boda-beso', 'aniversario', 'viaje-carretera', 'recuerdos', 'playa', 'boda-paseo']

// ── Motor de escenas (portado del prototipo aprobado) ────────────────────────

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Pliego del paso 3: izquierda una foto a sangre; derecha una grande y tres chicas.
const LAYOUT = [[0, 0, .5, 1], [.535, .06, .43, .5], [.535, .6, .133, .34], [.684, .6, .133, .34], [.833, .6, .133, .34]]
const SCATTER = [[-.36, -.02, -12], [.34, -.04, 9], [-.24, .26, 7], [.08, .3, -6], [.4, .24, 14], [-.06, .04, -4], [-.44, .34, 10], [.26, .38, -10]]

function startScrollScenes(root: HTMLElement): () => void {
  const $ = <T extends HTMLElement = HTMLElement>(ref: string) => root.querySelector<T>(`[data-ref="${ref}"]`)!
  const mobile = () => innerWidth < 720
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const progress = (el: HTMLElement, fixed: number) => {
    if (reduced) return fixed // sin animación: cada escena en su mejor momento
    const r = el.getBoundingClientRect()
    return clamp(-r.top / (el.offsetHeight - innerHeight))
  }

  const nav = root.querySelector<HTMLElement>('.st-nav')!
  const hero = root.querySelector<HTMLElement>('#hero')!, fmt = root.querySelector<HTMLElement>('#formatos')!
  const proc = root.querySelector<HTMLElement>('#proceso')!, det = root.querySelector<HTMLElement>('#detalles')!
  const hb = $('heroBook'), hc = $('heroCover'), hCopy = $('heroCopy'), hCap = $('heroCaption'), hSh = $('heroShadow'), hCt = $('heroContact')
  const slots = [...root.querySelectorAll<HTMLElement>('.st-shelf .st-slot')], fHead = $('fmtHead')
  const shelf = root.querySelector<HTMLElement>('.st-shelf')!
  const stage = $('procStage'), spread = $('spread'), pHead = $('procHead'), pHead2 = $('procHead2'), STAR = $('star'), GUTTER = $('gutter')
  const prints = [...root.querySelectorAll<HTMLElement>('[data-print]')]
  const db = $('detBook'), lines = [...root.querySelectorAll<HTMLElement>('[data-line]')]

  let HW = 0, SW = 0, SH = 0

  /*
   * Regla de las escenas: el texto va arriba y lo visual (libro, estante,
   * pliego) vive SOLO en el espacio que queda libre debajo. Se mide el texto
   * real (cambia con el ancho, el alto y la fuente), así en ninguna pantalla
   * —p. ej. un portátil bajo de ~600 px— lo visual puede tapar las letras.
   */
  const GAP = 24
  const bottomOf = (...els: HTMLElement[]) => Math.max(...els.map(e => e.offsetTop + e.offsetHeight))
  const stageH = () => hero.querySelector<HTMLElement>('.st-stage')!.clientHeight || innerHeight

  // Hero: dónde arranca el libro (debajo de los botones) y dónde queda abierto.
  let HERO_START_TY = 0, HERO_OPEN_TY = 0

  function sizeHero() {
    const H = stageH()
    // Abierto y con zoom, el libro cabe entre la barra y el texto de abajo.
    const top = 52 + GAP, bottom = H - hCap.offsetHeight - H * .07 - GAP
    const zoomS = mobile() ? 1.04 : 1.3
    const fit = (bottom - top) / zoomS
    const w = Math.max(80, mobile()
      ? Math.min(innerWidth * .44, H * .3, fit)
      : Math.min(innerWidth * .27, H * .4, fit))
    hb.style.setProperty('--w', w + 'px'); hb.style.setProperty('--h', w + 'px'); hb.style.setProperty('--t', Math.max(16, w * .09) + 'px')
    HW = w
    HERO_OPEN_TY = (top + bottom) / 2 - H / 2
    // Cerrado, empieza asomando debajo de los botones, nunca encima del texto.
    // Mientras gira crece hasta la escala de libro cerrado: se usa esa para que ni girando toque los botones.
    const sClosed = mobile() ? 1.35 : 1.15
    HERO_START_TY = Math.max(H * (mobile() ? .22 : .3), bottomOf(hCopy) + GAP + (w * sClosed) / 2 - H / 2)
  }
  function drawHero() {
    const p = progress(hero, .8)
    const turn = ease(seg(p, 0, .3)), open = ease(seg(p, .32, .66)), zoom = ease(seg(p, .7, 1))
    const closedScale = mobile() ? 1.35 : 1.15
    const s = lerp(lerp(mobile() ? 1.1 : .92, closedScale, turn), 1, open) * lerp(1, mobile() ? 1.04 : 1.3, zoom)
    // Empieza mostrando el lomo y gira de frente hacia ti; abierto, sigue flotando (opción A).
    const rx = lerp(14, 4, turn) * (1 - open), ry = lerp(42, 0, turn), rz = lerp(2, 0, turn)
    const tx = lerp(0, HW / 2, open)
    // Sube recién cuando el texto ya se desvaneció (el texto se va entre 3 % y 12 %).
    const ty = lerp(HERO_START_TY, HERO_OPEN_TY, ease(seg(p, .12, .32)))
    hb.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) perspective(${HW * 5}px) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`
    hc.style.setProperty('--open', (-178 * open) + 'deg')
    hc.querySelector<HTMLElement>('.st-cover-front')!.style.setProperty('--sheen', lerp(-10, 120, turn * .6 + open * .4) + '%')
    const sw = HW * s * lerp(1.15, 2.3, open), sh = HW * s * .22
    hSh.style.width = sw + 'px'; hSh.style.height = sh + 'px'
    hSh.style.transform = `translate(-50%, 0) translate(0px, ${ty + HW * s * .48}px)`
    hSh.style.opacity = String(lerp(.55, .8, open))
    hCt.style.width = HW * s * lerp(.95, 2.05, open) + 'px'; hCt.style.height = HW * s * .05 + 'px'
    hCt.style.transform = `translate(-50%, 0) translate(0px, ${ty + HW * s * .48}px)`
    hCt.style.opacity = String(lerp(.25, .75, turn))
    hCopy.style.opacity = String(reduced ? 1 : 1 - seg(p, .03, .12))
    hCopy.style.transform = reduced ? '' : `translateY(${-seg(p, 0, .12) * 50}px)`
    hCap.style.opacity = String(reduced ? 0 : seg(p, .7, .82))
    hCap.style.transform = `translateY(${(1 - seg(p, .7, .82)) * 20}px)`
  }

  function sizeShelf() {
    const H = stageH()
    const gapCm = mobile() ? 2.4 : 9
    const totalCm = 30 + 20 + 21 + gapCm * 2 + (mobile() ? 6 : 0)
    // Debajo del título caben: el libro más alto (30 cm), su ficha y un margen.
    const meta = slots[0].querySelector<HTMLElement>('.st-meta')!
    const metaH = meta.offsetHeight + parseFloat(getComputedStyle(meta).marginTop || '0')
    const bottomPad = Math.max(GAP, H * .06)
    const bookRoom = (H - bottomOf(fHead) - GAP * 1.5 - metaH - bottomPad) * .92 // .92: el giro 3D lo agranda un poco
    const u = Math.max(2, Math.min(innerWidth * (mobile() ? .9 : .78) / totalCm, H * .36 / 30, bookRoom / 30)) // px por cm
    shelf.style.bottom = bottomPad + 'px'
    slots.forEach((s, i) => {
      const w = Number(s.dataset.wcm) * u, h = Number(s.dataset.hcm) * u
      const b = s.querySelector<HTMLElement>('.st-book')!, holder = s.querySelector<HTMLElement>('.st-holder')!
      b.style.setProperty('--w', w + 'px'); b.style.setProperty('--h', h + 'px'); b.style.setProperty('--t', Math.max(7, u * 2.1) + 'px')
      holder.style.width = w + 'px'; holder.style.height = h + 'px'
      s.style.marginRight = i < slots.length - 1 ? gapCm * u + 'px' : '0'
      s.style.width = mobile() ? Math.max(w, 96) + 'px' : ''
    })
  }
  function drawFormats() {
    const p = progress(fmt, .9)
    fHead.style.opacity = String(reduced ? 1 : seg(p, 0, .12) * (1 - seg(p, .9, 1)))
    fHead.style.transform = `translateY(${(1 - seg(p, 0, .12)) * 24}px)`
    slots.forEach((s, i) => {
      const t = ease(seg(p, .08 + i * .1, .38 + i * .1)), turn = ease(seg(p, .5, .9))
      const b = s.querySelector<HTMLElement>('.st-book')!
      b.style.transform = `translateY(${(1 - t) * 160}px) rotateX(${lerp(8, 3, turn)}deg) rotateY(${lerp(-38, -14, turn) + i * 2}deg)`
      b.querySelector<HTMLElement>('.st-cover-front')!.style.setProperty('--sheen', lerp(0, 90, turn) + '%')
      s.style.opacity = String(t)
    })
  }

  // Zona libre del paso 3 (debajo de los dos títulos que se alternan).
  let AREA_TOP = 0, AREA_H = 0
  function sizeSpread() {
    const H = stageH()
    AREA_TOP = bottomOf(pHead, pHead2) + GAP
    AREA_H = Math.max(120, H - AREA_TOP - Math.max(GAP, H * .05))
    SW = Math.min(innerWidth * (mobile() ? .92 : .66), AREA_H * 2); SH = SW / 2
    spread.style.width = SW + 'px'; spread.style.height = SH + 'px'
    spread.style.top = AREA_TOP + AREA_H / 2 + 'px'
  }
  function drawProcess() {
    const p = progress(proc, .92)
    const g = ease(seg(p, .1, .5))      // fotos → página
    const pano = ease(seg(p, .6, .84))  // la favorita cruza el lomo
    pHead.style.opacity = String(seg(p, 0, .08) * (1 - seg(p, .54, .6)))
    pHead2.style.opacity = String(seg(p, .6, .68) * (reduced ? 1 : 1 - seg(p, .96, 1)))
    pHead2.style.transform = `translateY(${(1 - seg(p, .6, .68)) * 16}px)`
    STAR.style.opacity = String(seg(p, .52, .58))
    STAR.style.transform = `scale(${lerp(.4, 1, ease(seg(p, .52, .58)))})`
    spread.style.opacity = String(seg(p, .3, .6))
    const sr = spread.getBoundingClientRect(), st = stage.getBoundingClientRect()
    const pw = Math.min(innerWidth * (mobile() ? .3 : .17), 230)
    prints.forEach((el, i) => {
      const sc = SCATTER[i], startW = pw * (mobile() ? .9 : 1), startH = startW * .68
      const sx = st.width / 2 + sc[0] * st.width * (mobile() ? .9 : 1) - startW / 2
      // Las fotos sueltas se reparten en la zona libre (sc[1] va de -.04 a .38).
      const sy = AREA_TOP + ((sc[1] + .04) / .42) * Math.max(0, AREA_H - startH)
      let tx: number, ty: number, tw: number, th: number, op = 1
      if (i < LAYOUT.length) {
        const L = LAYOUT[i]
        tx = sr.left - st.left + (L[0] === 0 ? 0 : L[0] * SW); ty = sr.top - st.top + (L[0] === 0 ? 0 : L[1] * SH)
        tw = L[0] === 0 ? SW * .5 : L[2] * SW; th = L[0] === 0 ? SH : L[3] * SH
        if (i === 0) tw = lerp(tw, SW, pano) // doble página
        else op = 1 - pano
      } else { // las que sobran se apartan: Pixia elige las mejores
        tx = sx + (sc[0] < 0 ? -200 : 200); ty = sy; tw = startW; th = startH; op = 1 - g
      }
      el.style.width = lerp(startW, tw, g) + 'px'; el.style.height = lerp(startH, th, g) + 'px'
      el.style.padding = lerp(6, 0, g) + 'px'; el.style.opacity = String(op); el.style.zIndex = i === 0 ? '2' : '1'
      el.style.boxShadow = `0 2px 6px rgba(0,0,0,${.12 * (1 - g)}), 0 18px 30px -10px rgba(0,0,0,${.25 * (1 - g)})`
      el.style.transform = `translate(${lerp(sx, tx, g)}px, ${lerp(sy, ty, g)}px) rotate(${lerp(sc[2], 0, g)}deg)`
    })
    // Sombra del lomo sobre la foto que cruza: se lee como libro, no como foto suelta.
    GUTTER.style.left = (sr.left - st.left + SW / 2 - SW * .06) + 'px'; GUTTER.style.top = (sr.top - st.top) + 'px'
    GUTTER.style.width = SW * .12 + 'px'; GUTTER.style.height = SH + 'px'; GUTTER.style.opacity = String(pano)
  }

  const detLines = root.querySelector<HTMLElement>('.st-detail-lines')!
  function drawDetails() {
    const p = progress(det, .3)
    const H = stageH()
    // Zona libre bajo la frase más alta de las tres.
    const linesBottom = detLines.offsetTop + Math.max(...lines.map(l => l.offsetHeight))
    const room = H - linesBottom - GAP * 2
    // Escala máxima del acercamiento; 1.15: margen por el giro 3D y la perspectiva.
    const scMax = mobile() ? 1.25 : 1.4
    const w = Math.max(80, Math.min(innerWidth * (mobile() ? .6 : .3), H * .46, room / (scMax * 1.15)))
    db.style.setProperty('--w', w + 'px'); db.style.setProperty('--h', w + 'px'); db.style.setProperty('--t', w * .085 + 'px')
    const z = ease(p)
    const sc = lerp(1, scMax, z)
    // Centrado en la zona libre bajo las frases: el libro se ve completo de principio a fin.
    const ty = linesBottom + GAP + room / 2 - H / 2
    db.style.transform = `translate(-50%, -50%) translate(${lerp(0, w * .12, z)}px, ${ty}px) perspective(${w * 9}px) scale(${sc}) rotateX(${lerp(22, 12, z)}deg) rotateY(${lerp(-18, 30, z)}deg) rotateZ(${lerp(-5, -1, z)}deg)`
    db.querySelector<HTMLElement>('.st-cover-front')!.style.setProperty('--sheen', lerp(0, 130, p) + '%')
    lines.forEach((l, i) => {
      const a = .05 + i * .32
      const o = reduced ? (i === 0 ? 1 : 0) : i === lines.length - 1 ? seg(p, a, a + .08) : seg(p, a, a + .08) * (1 - seg(p, a + .24, a + .3))
      l.style.opacity = String(o)
      l.style.transform = reduced ? '' : `translateY(${(1 - seg(p, a, a + .08)) * 16}px)`
    })
  }

  let raf = 0
  function frame() {
    raf = 0
    drawHero(); drawFormats(); drawProcess(); drawDetails()
    const r = det.getBoundingClientRect()
    nav.classList.toggle('dark', r.top < 52 && r.bottom > 52)
  }
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame) }
  const onResize = () => { sizeHero(); sizeShelf(); sizeSpread(); frame() }

  onResize()
  // La fuente propia cambia el alto de los títulos: medir de nuevo cuando cargue.
  document.fonts?.ready.then(() => onResize()).catch(() => {})
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onResize)
  return () => {
    removeEventListener('scroll', onScroll)
    removeEventListener('resize', onResize)
    if (raf) cancelAnimationFrame(raf)
  }
}
