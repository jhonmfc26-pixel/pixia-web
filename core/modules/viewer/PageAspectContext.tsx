'use client'

import { createContext, useContext } from 'react'

/**
 * Proporción de página (ancho/alto) del álbum que se está mostrando: 1 en
 * 30×30 y 20×20, 0.75 en el vertical 21×28 (ver pageGeometry.ts). La usan
 * las vistas de página para calcular el recorte de cada foto en su slot.
 * Sin proveedor = cuadrado (todo lo anterior al vertical).
 */
export const PageAspectContext = createContext(1)
export const usePageAspect = () => useContext(PageAspectContext)
