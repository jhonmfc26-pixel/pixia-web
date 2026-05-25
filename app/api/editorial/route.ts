import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { photos, story, style, emotion } = await req.json()

    console.log('[Editorial] Iniciando con', photos?.length, 'fotos')
    console.log('[Editorial] API key existe:', !!process.env.ANTHROPIC_API_KEY)
    console.log('[Editorial] API key prefix:', process.env.ANTHROPIC_API_KEY?.slice(0, 10))

    const imageContent = (photos as { id: string; src: string }[]).map((photo, index) => ([
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: photo.src.replace(/^data:image\/\w+;base64,/, '')
        }
      },
      {
        type: 'text',
        text: `Foto ${index + 1} (ID: ${photo.id})`
      }
    ])).flat()

    const systemPrompt = `Eres el motor editorial de Pixia, una plataforma que transforma fotos personales en álbumes impresos de alta calidad.

Tu trabajo es analizar un conjunto de fotos y construir una narrativa editorial coherente dividida en 4 actos:
- INICIO (20% de las fotos): el comienzo, el contexto, la llegada
- DESARROLLO (40% de las fotos): el cuerpo de la historia, los momentos grupales
- CLIMAX (30% de las fotos): los momentos más emotivos e importantes
- CIERRE (10% de las fotos): el final, la despedida, la celebración final

Principios editoriales que SIEMPRE debes seguir:
1. Las fotos más emotivas (besos, abrazos, lágrimas de alegría) van al CLÍMAX
2. Las fotos de preparación o llegada van al INICIO
3. Las fotos grupales y de celebración van al DESARROLLO
4. La foto más icónica o el último momento del evento va al CIERRE
5. Dos fotos verticales juntas forman un spread (layout: split-horizontal)
6. Una foto horizontal sola forma un spread completo (layout: full-bleed)
7. Los captions deben ser poéticos, breves (máximo 12 palabras), en español

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin explicaciones.`

    const userPrompt = `Analiza estas ${photos.length} fotos de un evento de tipo "${story}" con estilo "${style}" y emoción "${emotion}".

Construye el álbum editorial completo. Responde con este JSON exacto:

{
  "albumTitle": "título poético del álbum en español, máximo 5 palabras",
  "globalNarrative": "descripción de la historia en 2 frases",
  "spreads": [
    {
      "id": "spread-0",
      "act": "inicio|desarrollo|climax|cierre",
      "layout": "full-bleed|split-horizontal|editorial-right",
      "photoIds": ["id-de-foto"],
      "caption": "caption poético máximo 12 palabras"
    }
  ]
}

Reglas para photoIds:
- full-bleed: exactamente 1 photoId
- split-horizontal: exactamente 2 photoIds (ambas verticales)
- editorial-right: exactamente 2 photoIds (primera vertical, segunda horizontal)

Usa TODOS los IDs de fotos proporcionados. Ninguna foto puede quedar sin asignar.`

    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: userPrompt }
          ]
        }
      ]
    }

    const payloadSize = JSON.stringify(requestBody).length
    console.log('[Editorial] Payload size bytes:', payloadSize)
    console.log('[Editorial] Llamando a Claude con', imageContent.length, 'elementos de contenido')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('[Editorial] Claude status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Editorial] Claude error body:', errorText)
      return NextResponse.json({ error: errorText }, { status: 500 })
    }

    const claudeResponse = await response.json()
    const content = (claudeResponse.content[0] as { text: string } | undefined)?.text ?? ''

    let editorial
    try {
      const clean = content.replace(/```json\n?|\n?```/g, '').trim()
      editorial = JSON.parse(clean)
    } catch {
      console.error('[Editorial] Error parsing Claude response:', content)
      return NextResponse.json(
        { error: 'Error parsing editorial response', raw: content },
        { status: 500 }
      )
    }

    console.log('[Editorial] Spreads generados:', editorial?.spreads?.length)
    return NextResponse.json({ editorial })

  } catch (error) {
    console.error('[Editorial] Route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
