import type { PhotoAsset, LayoutType } from '@/core/contracts/AlbumBlueprint'

export interface EditorState {
  selectedSpreadId: string | null
  selectedPhotoId: string | null
  availableAlternatives: PhotoAsset[]
  availableLayouts: LayoutType[]
  isDirty: boolean
}

export type EditorAction =
  | { type: 'SELECT_SPREAD'; spreadId: string }
  | { type: 'SELECT_PHOTO'; photoId: string }
  | { type: 'REPLACE_PHOTO'; spreadId: string; oldPhotoId: string; newPhoto: PhotoAsset }
  | { type: 'CHANGE_LAYOUT'; spreadId: string; newLayout: LayoutType }
  | { type: 'CLEAR_SELECTION' }
