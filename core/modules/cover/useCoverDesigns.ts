'use client'
import { useEffect, useState } from 'react'
import type { CoverDesign } from '@/lib/coverDesigns'

// Una sola petición por pestaña: el paso 3 y el estudio comparten el catálogo.
let cache: Promise<CoverDesign[]> | null = null

function load(): Promise<CoverDesign[]> {
  if (!cache) {
    cache = fetch('/api/cover-designs')
      .then(r => (r.ok ? r.json() : { designs: [] }))
      .then(j => (Array.isArray(j.designs) ? j.designs : []))
      .catch(() => { cache = null; return [] })
  }
  return cache
}

/** Catálogo de portadas subidas desde el admin (vacío mientras carga o si falla). */
export function useCoverDesigns(): CoverDesign[] {
  const [designs, setDesigns] = useState<CoverDesign[]>([])
  useEffect(() => {
    let alive = true
    load().then(d => { if (alive) setDesigns(d) })
    return () => { alive = false }
  }, [])
  return designs
}
