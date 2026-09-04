/**
 * Bundles the Service Worker entry to a classic worker script.
 *
 * A classic script keeps registration working in every browser the quality gate
 * runs, while the source stays TypeScript so the cache policy has exactly one
 * definition shared with the application and the unit tests.
 */
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = join(ROOT, 'app', 'features', 'pwa', 'service-worker.ts')

export async function buildServiceWorker(outfile, buildId) {
  await build({
    entryPoints: [ENTRY],
    outfile,
    bundle: true,
    format: 'iife',
    target: ['chrome111', 'firefox115', 'safari16'],
    minify: true,
    legalComments: 'none',
    define: { __SW_BUILD_ID__: JSON.stringify(buildId) },
  })

  return outfile
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , outfile = join(ROOT, '.output', 'public', 'sw.js'), buildId = 'local'] = process.argv
  await buildServiceWorker(outfile, buildId)
  console.log(`wrote ${outfile} (build ${buildId})`)
}
