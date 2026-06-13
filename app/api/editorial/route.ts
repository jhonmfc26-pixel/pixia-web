import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/core/middleware/rateLimiter'

export const runtime = 'edge'

const MAX_DESCRIPTIONS = 100
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_STRING_FIELD_LENGTH = 200

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, '/api/editorial')
  if (limited) return limited

  try {
    const body = await req.json()
    const { photoDescriptions, story, style, emotion } = body

    // Validar estructura mínima del payload
    if (!Array.isArray(photoDescriptions) || photoDescriptions.length === 0) {
      return NextResponse.json({ error: 'photoDescriptions debe ser un array no vacío' }, { status: 400 })
    }
    if (photoDescriptions.length > MAX_DESCRIPTIONS) {
      return NextResponse.json({ error: `Máximo ${MAX_DESCRIPTIONS} descripciones` }, { status: 400 })
    }
    if (typeof story !== 'string' || typeof style !== 'string' || typeof emotion !== 'string') {
      return NextResponse.json({ error: 'story, style y emotion son requeridos' }, { status: 400 })
    }
    if (story.length > MAX_STRING_FIELD_LENGTH || style.length > MAX_STRING_FIELD_LENGTH || emotion.length > MAX_STRING_FIELD_LENGTH) {
      return NextResponse.json({ error: 'Campos de texto demasiado largos' }, { status: 400 })
    }
    for (const d of photoDescriptions) {
      if (typeof d !== 'string' || d.length > MAX_DESCRIPTION_LENGTH) {
        return NextResponse.json({ error: 'Descripción de foto inválida o demasiado larga' }, { status: 400 })
      }
    }

    const descriptions = photoDescriptions as string[]
    const total = descriptions.length

    console.log('[Editorial] Iniciando con', total, 'descripciones')
    console.log('[Editorial] API key existe:', !!process.env.ANTHROPIC_API_KEY)

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
- No propongas layouts. Solo agrupa fotos y textos.

Fotos disponibles:
${enrichedDescriptions.join('\n')}

Responde SOLO JSON, sin markdown ni explicaciones:
{"albumTitle":"título 3-5 palabras","spreads":[{"act":"inicio","photoIndices":[0]}]}`
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
