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
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Organiza fotos de un álbum en spreads narrativos.

Evento: ${story}
${total} fotos en orden cronológico (primera = inicio del evento, última = final).

Divide en 4 actos:
- inicio: primer 20% (preparación, llegada)
- desarrollo: 40% intermedio (celebración, grupos)
- climax: 30% siguiente (momentos clave)
- cierre: último 10% (despedida)

Reglas:
- Cada foto solo UNA vez en todo el álbum (no repetir photoIndices).
- Usa TODAS las fotos.
- Layouts:
  - "full-bleed": 1 foto (momentos especiales)
  - "split-horizontal": 2 fotos verticales juntas
  - "editorial-right": 2 fotos (vertical + horizontal)

Fotos disponibles:
${enrichedDescriptions.join('\n')}

Responde SOLO JSON, sin markdown ni explicaciones:
{"albumTitle":"título 3-5 palabras","spreads":[{"act":"inicio","layout":"full-bleed","photoIndices":[0]}]}`
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
