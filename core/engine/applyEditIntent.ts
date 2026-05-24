import { PixiaBook } from '../domain/PixiaBook'
import { EditIntent } from '../domain/PixiaEditSession'

export function applyEditIntent(
  book: PixiaBook,
  intent: EditIntent
): PixiaBook {
  const newBook: PixiaBook = JSON.parse(JSON.stringify(book))

  const findSpreadIndex = (photoId: string) =>
    newBook.content.spreads.findIndex(spread =>
      spread.photos.some(p => p.id === photoId)
    )

  if (intent.type === 'EMPHASIZE_PHOTO') {
    const index = findSpreadIndex(intent.photoId)
    if (index === -1) return book

    const spread = newBook.content.spreads[index]

    spread.layout = 'single-impact'
    spread.act = 'climax'

    newBook.narrative.acts.forEach(act => {
      act.spreadIds = act.spreadIds.filter(id => id !== spread.id)
    })

    const climax = newBook.narrative.acts.find(a => a.id === 'climax')
    if (climax) climax.spreadIds.push(spread.id)

    newBook.editorial.decisions.push({
      id: `intent-${Date.now()}`,
      reason: `La imagen ${intent.photoId} fue convertida en el punto central del clímax.`
    })

    return newBook
  }

  if (intent.type === 'REDUCE_IMPACT') {
    const index = findSpreadIndex(intent.photoId)
    if (index === -1) return book

    const spread = newBook.content.spreads[index]

    spread.layout = 'double-balanced'
    spread.act = 'desarrollo'

    newBook.narrative.acts.forEach(act => {
      act.spreadIds = act.spreadIds.filter(id => id !== spread.id)
    })

    const desarrollo = newBook.narrative.acts.find(
      a => a.id === 'desarrollo'
    )
    if (desarrollo) desarrollo.spreadIds.push(spread.id)

    newBook.editorial.decisions.push({
      id: `intent-${Date.now()}`,
      reason: `Se redujo el protagonismo de la imagen ${intent.photoId}, integrándola nuevamente al desarrollo narrativo.`
    })

    return newBook
  }

  return book
}
