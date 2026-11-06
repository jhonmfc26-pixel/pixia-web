/**
 * Un álbum pagado queda congelado: es exactamente lo que se imprime. El cliente
 * lo puede seguir abriendo y mostrando, pero ya no editar ni volver a pagar.
 *
 * Solo 'draft' y 'preview' son editables; cualquier otro estado ('ordered',
 * 'paid', 'printing', 'shipped'...) cuenta como pedido.
 */
const EDITABLE = new Set(['draft', 'preview'])

export function isOrdered(status?: string | null): boolean {
  return !!status && !EDITABLE.has(status)
}

export type OrderStage = 'production' | 'shipped' | 'delivered'

export function orderStage(status?: string | null): OrderStage {
  if (status === 'delivered') return 'delivered'
  if (status === 'shipped') return 'shipped'
  return 'production'
}

export const ORDER_STAGE_LABEL: Record<OrderStage, string> = {
  production: 'Pedido · En producción',
  shipped: 'Pedido · En camino',
  delivered: 'Pedido · Entregado',
}
