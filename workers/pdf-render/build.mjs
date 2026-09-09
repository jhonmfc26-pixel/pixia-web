// Bundler propio con esbuild — NO se usa el bundler default de wrangler.
// Motivo: core/modules/print/*.tsx (y todo lo que importan — SpreadFaces,
// DedicationCard, CoverRenderer, etc.) usan el alias @/ configurado en el
// tsconfig.json de pixia-web (paths: {"@/*": ["./*"]}). El bundler default
// de wrangler no lee ese tsconfig (es de OTRO paquete), así que sin este
// paso @/core/... no resuelve a nada y el build del worker falla. Este
// script resuelve el alias vía esbuild directo y deja un bundle ya
// aplanado en dist/worker.js — wrangler.toml apunta `main` ahí, no a
// src/index.ts.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..') // pixia-web/

await build({
  entryPoints: [path.join(__dirname, 'src/index.ts')],
  bundle: true,
  outfile: path.join(__dirname, 'dist/worker.js'),
  format: 'esm',
  platform: 'browser', // Workers es un runtime V8 aislado, no Node — aunque nodejs_compat esté prendido para APIs puntuales
  target: 'es2022',
  minify: false,
  sourcemap: true,
  alias: { '@': repoRoot },
  jsx: 'automatic',
  logLevel: 'info',
  // @cloudflare/puppeteer usa node:buffer/node:stream internamente — con
  // nodejs_compat activado (wrangler.toml) el runtime del Worker SÍ los
  // provee de verdad; no hay que bundlearlos, solo dejar el import tal cual
  // para que workerd lo resuelva en runtime.
  external: ['node:*'],
})

console.log('✓ Worker bundleado en dist/worker.js')
