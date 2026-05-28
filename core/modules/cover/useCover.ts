'use client'
import { useState, useCallback } from 'react'
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import { detectTextColor } from './luminance'

export function useCover(initialConfig: CoverConfig) {
  const [config, setConfig] = useState<CoverConfig>(initialConfig)

  const updateField = useCallback(<K extends keyof CoverConfig>(
    field: K, value: CoverConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }, [])

  const setTemplate = useCallback((templateId: string) => {
    setConfig(prev => ({ ...prev, templateId }))
  }, [])

  const setPhoto = useCallback((photoId: string) => {
    setConfig(prev => ({ ...prev, photoId }))
  }, [])

  const autoDetectColor = useCallback(async (photoUrl: string) => {
    const color = await detectTextColor(photoUrl, config.textPosition)
    setConfig(prev => ({ ...prev, textColor: color }))
  }, [config.textPosition])

  return { config, updateField, setTemplate, setPhoto, autoDetectColor, setConfig }
}
