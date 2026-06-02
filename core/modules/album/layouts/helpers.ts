import type { LayoutSchema } from './types'
import { LAYOUTS } from './registry'

export function getLayoutById(id: string): LayoutSchema | undefined {
  return LAYOUTS.find(l => l.id === id)
}

export function getLayoutsByPhotoCount(count: number): LayoutSchema[] {
  return LAYOUTS.filter(l => l.photoCount === count)
}
