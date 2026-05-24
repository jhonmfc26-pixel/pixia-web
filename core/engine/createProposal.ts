import { PixiaBook } from '../domain/PixiaBook'
import { EditIntent } from '../domain/PixiaEditSession'
import { applyEditIntent } from './applyEditIntent'

export interface Proposal {
  previewBook: PixiaBook
  explanation: string
}

export function createProposal(
  book: PixiaBook,
  intent: EditIntent
): Proposal {
  const previewBook = applyEditIntent(book, intent)

  let explanation = 'Pixia propone un ajuste editorial.'

  if (intent.type === 'EMPHASIZE_PHOTO') {
  explanation =
    'Esta imagen se convertirá en el punto central del clímax, aumentando el impacto emocional.'
    }

    if (intent.type === 'REDUCE_IMPACT') {
    explanation =
    'La imagen volverá al desarrollo narrativo, reduciendo su protagonismo para equilibrar el ritmo.'
}

  return {
    previewBook,
    explanation
  }
}
