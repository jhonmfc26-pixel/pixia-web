import { PixiaBook } from './PixiaBook'

export type EditIntent =
  | {
      type: 'EMPHASIZE_PHOTO'
      photoId: string
    }
  | {
      type: 'REDUCE_IMPACT'
      photoId: string
    }
  | {
      type: 'GROUP_PHOTOS'
      photoIds: string[]
    }

export interface PixiaEditSession {
  sessionId: string
  baseBook: PixiaBook
  intents: EditIntent[]
  createdAt: string
}
