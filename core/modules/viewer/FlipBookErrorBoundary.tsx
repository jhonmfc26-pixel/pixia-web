'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  onError: (error: unknown) => void
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Si react-pageflip falla al montar o renderizar, avisa al padre (que cae
 * al render estático) en vez de dejar la pantalla negra/rota.
 */
export class FlipBookErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[Viewer] react-pageflip falló, usando fallback estático:', error)
    this.props.onError(error)
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}
