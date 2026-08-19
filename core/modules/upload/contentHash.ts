/**
 * Hash del contenido de un archivo (SHA-256 sobre los bytes crudos, antes de
 * cualquier conversión HEIC→JPEG o compresión). Dos archivos con el mismo
 * hash son, en la práctica, la misma foto — se usa para deduplicar uploads.
 */
export async function hashFileContent(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
