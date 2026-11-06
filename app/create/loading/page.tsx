'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Ruta vieja: era una espera falsa de 30 s antes de generar. La generación
 * (con progreso real) vive ahora en /create/result. Se deja este redirect
 * por si alguien queda con la URL abierta.
 */
export default function LegacyLoadingRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/create/result') }, [router])
  return null
}
