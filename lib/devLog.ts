/**
 * console.log solo fuera de producción — para el ruido de diagnóstico del
 * motor de layout (pageEngine/groupPhotos), que no aporta nada a un cliente
 * real y solo ensucia la consola. console.warn/console.error NO pasan por
 * acá a propósito: esos sí representan casos de degradación reales (fallback
 * aplicado, pliego huérfano) que vale la pena poder ver en producción.
 */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') console.log(...args)
}
