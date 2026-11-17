import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Sin caché incremental: Pixia no usa ISR ni revalidación. Las páginas
// estáticas salen de los assets y el resto se arma en cada petición.
export default defineCloudflareConfig({})
