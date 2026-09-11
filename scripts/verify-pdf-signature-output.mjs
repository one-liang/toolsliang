/**
 * Measures what the shipped PDF signature worker actually writes into a
 * document, in the three browsers the product supports.
 *
 * Operators run this; CI never does. The e2e suite can prove that an export
 * appends to the original bytes and that a protected file comes back without
 * its `/Encrypt` dictionary, but it cannot look at pixels: a browser page has
 * no PDF renderer of its own. This harness supplies that half — the ink lands
 * inside the rectangle, nothing changes outside it, the page still shows
 * through the transparent parts, and the pages nobody signed come back
 * unchanged — and writes it where `tests/pdf-signature-output.test.ts` can hold
 * the product to it.
 *
 * Nothing leaves the machine. The documents are drawn from code by
 * `scripts/pdf-engine/fixtures.mjs`, the worker is the file the application
 * ships, bundled here with the project's own esbuild, and the only origin the
 * browsers talk to is this script's own server.
 *
 *   node scripts/verify-pdf-signature-output.mjs [--browsers=chromium,firefox,webkit]
 */
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { arch, cpus, platform } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium, firefox, webkit } from '@playwright/test'
import { buildFixtures, fixtureOwnerPassword, fixturePassword } from './pdf-engine/fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'artifacts', 'pdf-signature')
const OUTPUT = join(ROOT, 'docs', 'research', 'data', '010-pdf-signature-verification.json')
const WORKER_SOURCE = join(ROOT, 'app', 'features', 'tools', 'pdf-signature', 'pdf-signature.worker.ts')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
}

/**
 * The documents worth verifying at the pixel level: every page structure the
 * matrix covered that the tool actually opens, plus both encryption revisions.
 * The refused ones are covered by the e2e suite, which checks the sentence the
 * visitor reads rather than the pixels they never see.
 */
const VERIFIED_FIXTURES = [
  'rotated-pages',
  'offset-crop-box',
  'object-stream',
  'active-content',
  'broken-xref',
  'encrypted-rc4-128',
  'encrypted-aes-128',
  'reference-20-page',
]

/** The documents the tool has to refuse, and the code each refusal must carry. */
const REFUSED_FIXTURES = [
  { name: 'owner-password-restricted', password: fixtureOwnerPassword, code: 'modification_not_permitted' },
  { name: 'truncated', password: undefined, code: 'damaged_pdf' },
  { name: 'page-cap-120', password: undefined, code: 'too_many_pages' },
]

const requested = process.argv.find(argument => argument.startsWith('--browsers='))
const browserNames = requested ? requested.split('=')[1].split(',') : ['chromium', 'firefox', 'webkit']

const LAUNCHERS = { chromium, firefox, webkit }

async function bundleWorker() {
  await mkdir(WORK, { recursive: true })
  const outfile = join(WORK, 'engine-worker.mjs')
  await build({
    entryPoints: [WORKER_SOURCE],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outfile,
    logLevel: 'silent',
  })

  return outfile
}

function startServer(files) {
  const served = []
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname
    served.push(path)
    const target = files.get(path)
    if (!target) {
      response.writeHead(404).end('not found')
      return
    }
    response.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream')
    response.writeHead(200)
    await pipeline(createReadStream(target), response)
  })

  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, served, port: server.address().port })))
}

function passwordFor(fixture) {
  return fixture.encrypted ? fixturePassword : undefined
}

async function main() {
  const workerFile = await bundleWorker()
  const files = new Map([
    ['/harness.html', join(ROOT, 'scripts', 'pdf-signature', 'harness.html')],
    ['/engine-worker.mjs', workerFile],
    ['/vendor/pdf.mjs', join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.mjs')],
    ['/vendor/pdf.worker.mjs', join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs')],
  ])

  const fixtures = buildFixtures()
  /* Written to disk and served, rather than handed to the browser: the largest
   * representative document is 20 MiB, which no driver connection should carry. */
  await mkdir(join(WORK, 'fixtures'), { recursive: true })
  for (const fixture of fixtures) {
    const path = join(WORK, 'fixtures', `${fixture.name}.pdf`)
    await writeFile(path, fixture.bytes)
    files.set(`/fixtures/${fixture.name}.pdf`, path)
  }

  const { server, served, port } = await startServer(files)
  const origin = `http://127.0.0.1:${port}`
  const workerBytes = (await readFile(workerFile)).byteLength

  const browsers = []
  for (const name of browserNames) {
    process.stdout.write(`${name}\n`)
    const browser = await LAUNCHERS[name].launch()
    const runs = []
    let environment

    for (const wanted of [...VERIFIED_FIXTURES, ...REFUSED_FIXTURES.map(entry => entry.name)]) {
      const fixture = fixtures.find(entry => entry.name === wanted)
      if (!fixture) throw new Error(`unknown fixture: ${wanted}`)
      const refusal = REFUSED_FIXTURES.find(entry => entry.name === wanted)

      /* One page per document, so a library's memory is returned before the next. */
      const page = await browser.newPage()
      const requests = []
      page.context().on('request', request => requests.push(request.url().replace(/[?#].*$/, '')))
      const consoleErrors = []
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200)) })
      page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`))
      await page.goto(`${origin}/harness.html`)
      environment ??= await page.evaluate(() => window.__environment())

      const report = await page.evaluate(job => window.__verify(job), {
        fixture: { name: fixture.name, url: `${origin}/fixtures/${fixture.name}.pdf` },
        password: refusal ? refusal.password : passwordFor(fixture),
      })
      const workerError = await page.evaluate(() => window.__workerError ?? null)

      runs.push({
        ...report,
        expectedCode: refusal?.code ?? null,
        consoleErrors,
        workerError,
        /*
         * Every address the browser asked for while this document was open.
         * A `blob:` URL of this origin is the page reading bytes it made
         * itself — WebKit reports those as requests and the others do not — so
         * it is counted, not treated as an address anything was sent to.
         */
        unexpectedRequests: [...new Set(requests)].filter(url => !url.startsWith(origin) && !url.startsWith(`blob:${origin}`)),
        localBlobReads: [...new Set(requests)].filter(url => url.startsWith(`blob:${origin}`)).length,
      })
      process.stdout.write(`  ${fixture.name}: ${report.outcome}${report.code ? ` (${report.code})` : ''}\n`)
      await page.close()
    }

    browsers.push({ name, environment, runs })
    await browser.close()
  }

  server.close()

  const measurements = {
    measuredAt: new Date().toISOString().slice(0, 10),
    host: { platform: platform(), arch: arch(), cpus: cpus().length },
    previewScale: 1.5,
    signatureRect: { x: 0.1, y: 0.03, width: 0.3, height: 0.09 },
    workerBundleBytes: workerBytes,
    passwords: { user: fixturePassword, owner: fixtureOwnerPassword },
    servedPaths: [...new Set(served)].sort(),
    browsers,
  }

  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(measurements, null, 2)}\n`)
  process.stdout.write(`\nwrote ${OUTPUT}\n`)
}

await main()
