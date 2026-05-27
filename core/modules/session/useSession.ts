'use client'

import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase/client'
import type { FunnelEvent } from '@/core/contracts/AlbumBlueprint'

const SESSION_KEY = 'pixia_session_id'

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    initSession()
  }, [])

  async function initSession() {
    let id = localStorage.getItem(SESSION_KEY)

    if (!id) {
      id = uuidv4()
      localStorage.setItem(SESSION_KEY, id)

      // Registrar en Supabase
      await supabase.from('sessions').insert({
        session_key: id,
        funnel_stage: 'session_started'
      })
    }

    setSessionId(id)
    setIsReady(true)
  }

  async function trackEvent(
    event: FunnelEvent,
    blueprintId?: string,
    metadata?: Record<string, unknown>
  ) {
    if (!sessionId) return

    await supabase.from('funnel_events').insert({
      session_id: sessionId,
      blueprint_id: blueprintId || null,
      event_type: event,
      metadata: metadata || {}
    })
  }

  async function updateFunnelStage(stage: FunnelEvent) {
    if (!sessionId) return

    await supabase
      .from('sessions')
      .update({ funnel_stage: stage })
      .eq('session_key', sessionId)
  }

  return {
    sessionId,
    isReady,
    trackEvent,
    updateFunnelStage
  }
}
