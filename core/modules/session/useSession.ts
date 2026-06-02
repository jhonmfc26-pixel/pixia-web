'use client'

import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { FunnelEvent } from '@/core/contracts/AlbumBlueprint'

const SESSION_KEY = 'pixia_session_id'

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = uuidv4()
      localStorage.setItem(SESSION_KEY, id)
    }
    setSessionId(id)
    setIsReady(true)
  }, [])

  // Supabase no activo — no-ops hasta que se integre
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function trackEvent(_event: FunnelEvent, _blueprintId?: string, _metadata?: Record<string, unknown>) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function updateFunnelStage(_stage: FunnelEvent) {}

  return { sessionId, isReady, trackEvent, updateFunnelStage }
}
