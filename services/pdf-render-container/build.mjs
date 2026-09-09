// Bundler propio con esbuild — mismo motivo que workers/pdf-render/build.mjs:
// core/modules/print/*.tsx usa el alias @/ del tsconfig.json raíz de
// pixia-web, y el resto del código de este paquete necesita resolverlo
// contra el repo. Bundlea todo EXCEPTO las deps nativas/pesadas (playwright,
// express, @aws-sdk, @supabase) — esas quedan como imports normales de
// node_modules, instaladas por el Dockerfile vía `npm ci`. Playwright en
// particular NO se puede bundlear: gestiona su propio binario de Chromium
// por fuera del bundle de JS.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..') // pixia-web/

await build({
  entryPoints: [path.join(__dirname, 'src/server.ts')],
  bundle: true,
  outfile: path.join(__dirname, 'dist/server.js'),
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: false,
  sourcemap: true,
  alias: { '@': repoRoot },
  jsx: 'automatic',
  logLevel: 'info',
  packages: 'external', // node_modules (playwright, express, @aws-sdk/*, @supabase/*, react, react-dom) se quedan afuera del bundle
})

console.log('✓ Servicio bundleado en dist/server.js')
