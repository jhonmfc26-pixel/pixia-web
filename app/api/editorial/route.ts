import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { photoDescriptions, story, style, emotion } = await req.json()

    console.log('[Editorial] Iniciando con', photoDescriptions?.length, 'descripciones')
    console.log('[Editorial] API key existe:', !!process.env.ANTHROPIC_API_KEY)
    console.log('[Editorial] API key prefix:', process.env.ANTHROPIC_API_KEY?.slice(0, 10))

    const descriptions = photoDescriptions as string[]
    const total = descriptions.length

    const enrichedDescriptions = descriptions.map((d, i) => {
      const position = total <= 1 ? 0 : i / (total - 1)
      const moment = position < 0.2
        ? 'inicio del evento (preparación, llegada)'
        : position < 0.6
          ? 'durante el evento (celebración, momentos grupales)'
          : position < 0.9
            ? 'clímax del evento (momentos más especiales)'
            : 'final del evento (despedida, celebración final)'
      return `Foto ${i + 1}: ${d} - Posición en el evento: ${moment}`
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Eres el motor editorial de Pixia.

Evento: ${story}
Estilo: ${style}
Emoción: ${emotion}

Fotos disponibles (${total} fotos):
${enrichedDescriptions.join('\n')}

El orden de las fotos es cronológico — las primeras fotos ocurrieron antes en el tiempo que las últimas.
Respeta este orden temporal al asignar los actos.
Las fotos de preparación siempre van en INICIO.
Las fotos del momento principal van en CLÍMAX.
Las fotos de celebración final van en CIERRE.

CRÍTICO: Cada foto solo puede aparecer UNA VEZ en todo el álbum. Nunca repitas un photoIndex.

IMPORTANTE: Todos los captions deben estar en español. El albumTitle también en español.

Construye el álbum editorial dividiendo en 4 actos narrativos.
Responde SOLO con JSON válido, sin markdown:

{
  "albumTitle": "título poético máximo 5 palabras",
  "spreads": [
    {
      "id": "spread-0",
      "act": "inicio",
      "layout": "full-bleed",
      "photoIndices": [0],
      "caption": "caption poético máximo 10 palabras"
    }
  ]
}

Reglas de actos (proporciones del total de fotos):
- inicio: primeras 20% fotos (llegada, preparación, contexto)
- desarrollo: siguientes 40% (momentos grupales, celebración)
- climax: siguientes 30% (momentos más emotivos e importantes)
- cierre: últimas 10% (despedida, final)

Reglas de layout:
- foto horizontal sola → "full-bleed" (photoIndices: 1 foto)
- dos fotos verticales → "split-horizontal" (photoIndices: 2 fotos)
- mezcla vertical+horizontal → "editorial-right" (photoIndices: 2 fotos)
- momentos muy especiales solos → "full-bleed"

Usa photoIndices (números 0-based) para referenciar fotos.
Usa TODAS las fotos. Ninguna puede quedar sin asignar.

REGLA ABSOLUTA: Haz una lista mental de todos los photoIndices que usas. Antes de finalizar el JSON, verifica que ningún número aparezca dos veces en toda la respuesta. Si una foto ya fue usada en un spread anterior, NO la uses de nuevo. Es preferible tener menos spreads que repetir fotos.`
        }]
      })
    })

    console.log('[Editorial] Claude status:', response.status)

    if (!response.ok) {
      const err = await response.text()
      console.error('[Editorial] Claude error body:', err)
      return NextResponse.json({ error: err }, { status: 500 })
    }

    const data = await response.json()
    const text = (data.content[0] as { text?: string } | undefined)?.text ?? '{}'

    try {
      const clean = text.replace(/```json\n?|\n?```/g, '').trim()
      const editorial = JSON.parse(clean)
      console.log('[Editorial] Spreads generados:', editorial?.spreads?.length)

      // Deduplicar — cada photoIndex solo una vez
      const usedIndices = new Set<number>()
      const deduplicatedSpreads = (editorial.spreads ?? [])
        .map((spread: { photoIndices?: number[] } & Record<string, unknown>) => {
          const uniqueIndices = (spread.photoIndices ?? [])
            .filter((idx: number) => {
              if (usedIndices.has(idx)) return false
              usedIndices.add(idx)
              return true
            })
          return { ...spread, photoIndices: uniqueIndices }
        })
        .filter((spread: { photoIndices: number[] }) => spread.photoIndices.length > 0)

      editorial.spreads = deduplicatedSpreads
      console.log('[Editorial] Índices únicos usados:', [...usedIndices])
      console.log('[Editorial] Spreads tras deduplicar:', deduplicatedSpreads.length)

      return NextResponse.json({ editorial })
    } catch {
      console.error('[Editorial] Parse error, raw:', text)
      return NextResponse.json({ error: 'Parse error', raw: text }, { status: 500 })
    }

  } catch (error) {
    console.error('[Editorial] Route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
