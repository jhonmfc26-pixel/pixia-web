import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { photoDescriptions, story, style, emotion } = await req.json()

    console.log('[Editorial] Iniciando con', photoDescriptions?.length, 'descripciones')
    console.log('[Editorial] API key existe:', !!process.env.ANTHROPIC_API_KEY)
    console.log('[Editorial] API key prefix:', process.env.ANTHROPIC_API_KEY?.slice(0, 10))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Eres el motor editorial de Pixia.

Evento: ${story}
Estilo: ${style}
Emoción: ${emotion}

Fotos disponibles (${photoDescriptions.length} fotos):
${(photoDescriptions as string[]).map((d, i) => `Foto ${i + 1}: ${d}`).join('\n')}

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
Usa TODAS las fotos. Ninguna puede quedar sin asignar.`
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
