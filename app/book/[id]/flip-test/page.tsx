'use client'

// RUTA TEMPORAL DE DIAGNÓSTICO — borrar después
// Monta react-pageflip SIN dynamic/ssr:false para reproducir el error original.
// Abrir en /book/[cualquier-id]/flip-test y copiar el error de la consola.

export const runtime = 'edge'

import HTMLFlipBook from 'react-pageflip'

export default function FlipTest() {
  return (
    <div style={{ padding: 40, background: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: 'white', fontFamily: 'monospace' }}>
        flip-test — react-pageflip directo, sin dynamic ssr:false
      </p>
      <HTMLFlipBook
        width={300}
        height={300}
        size="fixed"
        minWidth={100} maxWidth={600}
        minHeight={100} maxHeight={600}
        showCover={false}
        drawShadow={true}
        flippingTime={700}
        useMouseEvents={true}
        usePortrait={false}
        startPage={0}
        autoSize={false}
        maxShadowOpacity={0.5}
        mobileScrollSupport={false}
        clickEventForward={false}
        swipeDistance={30}
        showPageCorners={true}
        disableFlipByClick={false}
        startZIndex={20}
        renderOnlyPageLengthChange={false}
        onFlip={() => {}}
        onInit={() => {}}
        className=""
        style={{}}
      >
        <div style={{ width: '100%', height: '100%', background: '#E8553A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24 }}>
          Página 1
        </div>
        <div style={{ width: '100%', height: '100%', background: '#3A7CE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24 }}>
          Página 2
        </div>
        <div style={{ width: '100%', height: '100%', background: '#3AE87C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24 }}>
          Página 3
        </div>
      </HTMLFlipBook>
    </div>
  )
}
