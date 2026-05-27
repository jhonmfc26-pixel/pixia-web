'use client'
import { useState, useCallback } from 'react'
import type { AlbumBlueprint, PhotoAsset, LayoutType } from '@/core/contracts/AlbumBlueprint'
import type { EditorState } from './types'

export function useEditor(book: AlbumBlueprint) {
  const [state, setState] = useState<EditorState>({
    selectedSpreadId: null,
    selectedPhotoId: null,
    availableAlternatives: [],
    availableLayouts: [],
    isDirty: false,
  })

  const [spreads, setSpreads] = useState(book.spreads)

  const selectPhoto = useCallback((spreadId: string, photoId: string) => {
    console.log('[Editor] Foto seleccionada:', spreadId, photoId)
    const spread = spreads.find(s => s.id === spreadId)
    if (!spread) return

    const alternatives: PhotoAsset[] = []

    const compatibleLayouts: LayoutType[] = spread.photos.length === 1
      ? ['full', 'portrait']
      : ['duo-v', 'duo-h', 'hero-2']

    setState({
      selectedSpreadId: spreadId,
      selectedPhotoId: photoId,
      availableAlternatives: alternatives,
      availableLayouts: compatibleLayouts,
      isDirty: false,
    })
  }, [spreads])

  const replacePhoto = useCallback((
    spreadId: string,
    oldPhotoId: string,
    newPhoto: PhotoAsset,
  ) => {
    setSpreads(prev => prev.map(s => {
      if (s.id !== spreadId) return s
      return { ...s, photos: s.photos.map(p => p.id === oldPhotoId ? newPhoto : p) }
    }))
    setState(prev => ({ ...prev, isDirty: true, selectedPhotoId: null }))
  }, [])

  const changeLayout = useCallback((spreadId: string, newLayout: LayoutType) => {
    const PHOTOS_NEEDED: Record<LayoutType, number> = {
      'full': 1, 'double': 1, 'portrait': 1,
      'duo-v': 2, 'duo-h': 2,
      'trio': 3, 'hero-2': 3,
    }

    setSpreads(prev => {
      const idx = prev.findIndex(s => s.id === spreadId)
      if (idx === -1) return prev

      const needed  = PHOTOS_NEEDED[newLayout]
      const current = prev[idx]
      const next    = prev[idx + 1]
      const pool    = [...current.photos, ...(next?.photos ?? [])]

      const forCurrent = pool.slice(0, needed)
      const forNext    = pool.slice(needed)

      if (forCurrent.length < needed) {
        console.warn('[Editor] No hay suficientes fotos para este layout')
        return prev
      }

      const newSpreads = [...prev]
      newSpreads[idx] = { ...current, layout: newLayout, photos: forCurrent }

      if (next && forNext.length > 0) {
        newSpreads[idx + 1] = {
          ...next,
          photos: forNext,
          layout: forNext.length >= 2 ? 'duo-v' : 'full',
        }
      }

      return newSpreads.filter(s => s.photos.length > 0)
    })

    setState(prev => ({ ...prev, isDirty: true, selectedSpreadId: null }))
  }, [])

  const clearSelection = useCallback(() => {
    setState(prev => ({
      selectedSpreadId: null,
      selectedPhotoId: null,
      availableAlternatives: [],
      availableLayouts: [],
      isDirty: prev.isDirty,
    }))
  }, [])

  return {
    spreads,
    editorState: state,
    selectPhoto,
    replacePhoto,
    changeLayout,
    clearSelection,
  }
}
