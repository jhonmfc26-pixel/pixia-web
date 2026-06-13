import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { LayoutId } from '@/core/modules/album/layouts/registry'

export interface EditorState {
  selectedSpreadId: string | null
  selectedPhotoId: string | null
  availableAlternatives: PhotoAsset[]
  availableLayouts: LayoutId[]
  isDirty: boolean
}

export type EditorAction =
  | { type: 'SELECT_SPREAD'; spreadId: string }
  | { type: 'SELECT_PHOTO'; photoId: string }
  | { type: 'REPLACE_PHOTO'; spreadId: string; oldPhotoId: string; newPhoto: PhotoAsset }
  | { type: 'CHANGE_LAYOUT'; spreadId: string; newLayout: LayoutId }
  | { type: 'CLEAR_SELECTION' }
