/**
 * Measures the T26 Word to PDF candidates in real browsers.
 *
 * Operators run this; CI never does. It downloads the pinned npm tarballs into
 * the ignored `artifacts/` directory, checks each against the integrity string
 * the registry published for that version, extracts only the files the harness
 * loads, writes the corpus from code, serves everything from localhost and
 * drives Playwright through the matrix.
 *
 * No document leaves the machine. The corpus is written by
 * `scripts/word-to-pdf/fixtures.mjs`, there is no real DOCX anywhere in it, and
 * the only outbound requests are the pinned package downloads, which are
 * skipped once the files are on disk. The corpus contains one document that
 * points at an unreachable address on purpose: every request the browser makes
 * is recorded, so a converter that followed it would be visible in the result.
 *
 *   node scripts/evaluate-word-to-pdf.mjs [--browsers=chromium,firefox,webkit]
 *                                         [--pipelines=docx-preview,…]
 *                                         [--fixtures=plain-paragraphs,…]
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { cpus } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { brotliCompress, constants } from 'node:zlib'
import { chromium, firefox, webkit } from '@playwright/test'
import { exclusions, libraries, permittedLicences, pipelines as allPipelines, verifierId } from './word-to-pdf/candidates.mjs'
import { EXTERNAL_LINK_PROBE, buildFixtures, fixtureCategories } from './word-to-pdf/fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'artifacts', 'word-to-pdf')
const OUTPUT = join(ROOT, 'docs', 'research', 'data', '011-word-to-pdf-measurements.json')
const HARNESS = join(ROOT, 'scripts', 'word-to-pdf', 'harness.html')

const compress = promisify(brotliCompress)
const run = promisify(execFile)

/**
 * The budgets §12.13 of the specification sets, in the units the harness
 * reports. They are recorded with the results so a later reader does not have
 * to trust that the verdict was measured against the right numbers.
 */
export const budgets = {
  firstProgressMs: 250,
  referenceConversionMs: 30_000,
  mainThreadTaskMs: 50,
  referenceFixture: 'reference-20-page',
}

/** How the rasterising pipelines photograph a page. */
const RASTER = {
  scale: 1.5,
  /* A4 at 96 dpi, the height a page-less conversion has to be sliced at. */
  sliceHeightPx: 1123,
  imageFormat: 'JPEG',
  imageQuality: 0.92,
}

/**
 * Documents memory is sampled on. `measureUserAgentSpecificMemory()` resolves
 * on the next garbage collection, which costs tens of seconds a call, so it is
 * asked for where the number carries information — the smallest document, the
 * biggest one, and the shapes in between — rather than on all five hundred jobs.
 */
const MEMORY_SUBSET = [
  'plain-paragraphs',
  'inline-image',
  'image-gallery',
  'long-table-repeat-header',
  'reference-20-page',
  'large-120-page',
]

/** Documents the PDF-producing pipelines run on. The rest are measured for fidelity only. */
const PDF_SUBSET = [
  'plain-paragraphs',
  'cjk-latin-mixed',
  'simple-table',
  'lists-bullet-and-numbered',
  'explicit-page-breaks',
  'word-cached-page-breaks',
  'flowing-overflow-no-breaks',
  'orientation-mixed',
  'headers-and-footers',
  'footnotes',
  'inline-image',
  'tracked-changes',
  'reference-20-page',
]

/** No single job may stall the matrix; past this the run is recorded as timed out. */
const JOB_TIMEOUT_MS = 240_000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.docm': 'application/vnd.ms-word.document.macroEnabled.12',
  '.doc': 'application/msword',
}

function argument(name, fallback) {
  const found = process.argv.find(entry => entry.startsWith(`--${name}=`))
  return found ? found.split('=').slice(1).join('=').split(',') : fallback
}

async function sha256(path) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

async function exists(path) {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}

/** npm publishes `sha512-<base64>`; the tarball is rejected when it does not match. */
async function verifyIntegrity(path, integrity) {
  const [algorithm, expected] = integrity.split('-')
  const hash = createHash(algorithm)
  await pipeline(createReadStream(path), hash)
  const digest = hash.digest('base64')
  if (digest !== expected) throw new Error(`integrity_mismatch ${path}: expected ${expected}, measured ${digest}`)
}

async function download(url, path) {
  await mkdir(dirname(path), { recursive: true })
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download_failed ${response.status} ${url}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(path))
}

/** Brotli at quality 5, the level a static host applies to a bundled asset. */
async function transferSizes(path) {
  const raw = await readFile(path)
  const brotli = await compress(raw, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 5,
      [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  })
  return { bytes: raw.length, brotliBytes: brotli.length }
}

async function prepareLibrary(library, files) {
  const directory = join(WORK, 'packages', library.id)
  const tarball = join(directory, 'package.tgz')
  const url = `https://registry.npmjs.org/${library.package}/-/${library.package.split('/').pop()}-${library.version}.tgz`

  if (!await exists(tarball)) {
    process.stdout.write(`  downloading ${library.package}@${library.version}\n`)
    await download(url, tarball)
  }
  await verifyIntegrity(tarball, library.integrity)

  const extracted = join(directory, 'files')
  const wanted = Object.values(library.files)
  if (!await exists(join(extracted, wanted[0]))) {
    await mkdir(extracted, { recursive: true })
    await run('tar', ['xzf', tarball, '-C', extracted, ...wanted])
  }

  const served = {}
  const assets = []
  for (const [role, member] of Object.entries(library.files)) {
    const path = join(extracted, member)
    const route = `/lib/${library.id}/${member.replace('package/', '')}`
    files.set(route, path)
    served[role] = route
    assets.push({ role, file: member.replace('package/', ''), sha256: await sha256(path), ...await transferSizes(path) })
  }

  return { urls: served, assets }
}

function startServer(files) {
  /*
   * The paths actually served. The per-job check is made from the browser's own
   * request events, which see every origin; this list is the cross-check that
   * the two agree about what the harness was asked for.
   */
  const served = []
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname
    served.push(path)
    /* Chromium asks for this on its own; without a route it lands in the harness console. */
    if (path === '/favicon.ico') {
      response.writeHead(204).end()
      return
    }

    const target = files.get(path)
    if (!target) {
      response.writeHead(404).end('not found')
      return
    }
    /* The memory API the harness samples is only offered to a cross-origin isolated page. */
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    response.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream')
    response.writeHead(200)
    await pipeline(createReadStream(target), response)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, served, port: server.address().port }))
  })
}

const LAUNCHERS = {
  /* Visible, because `measureUserAgentSpecificMemory()` only samples a page a user could see. */
  chromium: () => chromium.launch({ headless: false }),
  firefox: () => firefox.launch(),
  webkit: () => webkit.launch(),
}

function runPath(browser, pipelineId, fixture) {
  return join(WORK, 'runs', `${browser}__${pipelineId}__${fixture}.json`)
}

async function loadRuns(browser) {
  const directory = join(WORK, 'runs')
  await mkdir(directory, { recursive: true })
  const files = await readdir(directory)
  const runs = []
  for (const file of files.filter(name => name.startsWith(`${browser}__`) && name.endsWith('.json')).sort()) {
    runs.push(JSON.parse(await readFile(join(directory, file), 'utf8')))
  }
  return runs
}

async function openHarness(browser, port, messages, requested = []) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  /*
   * Context level, and the full URL. The server's own log only sees what it was
   * asked to serve, so a document that persuaded a converter to fetch something
   * elsewhere would leave no trace there. This sees every request the browser
   * makes, including from workers, to any origin.
   */
  page.context().on('request', request => requested.push(request.url()))
  page.on('pageerror', error => messages.push(String(error).slice(0, 200)))
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text().slice(0, 200))
  })
  await page.goto(`http://127.0.0.1:${port}/harness.html`)
  await page.waitForFunction('window.__ready === true', null, { timeout: 60_000 })
  return page
}

async function runJob(browserName, browser, port, served, messages, payload, label) {
  process.stdout.write(`  ${label}\n`)
  served.length = 0
  const requested = []
  const page = await openHarness(browser, port, messages, requested)
  await page.bringToFront()

  const started = Date.now()
  const report = await Promise.race([
    page.evaluate(job => window.__run(job), payload),
    new Promise(resolve => setTimeout(() => resolve({
      pipelineId: payload.pipeline.id,
      fixture: payload.fixture.name,
      output: payload.pipeline.output,
      outcome: 'timeout',
      error: { name: 'Timeout', message: `job_timeout_after_${JOB_TIMEOUT_MS}ms` },
      stages: {},
    }), JOB_TIMEOUT_MS)),
  ])
  report.wallClockMs = Date.now() - started
  await page.close()

  /*
   * What the job was allowed to ask for. Anything else — the address a
   * document's hyperlink points at, a library reaching past the files it was
   * given — is recorded rather than judged here.
   */
  const origin = `http://127.0.0.1:${port}`
  const expected = new Set(['/harness.html', '/favicon.ico',
    payload.fixture.url, ...payload.pipeline.scripts, ...Object.values(payload.verifierUrls)]
    .map(path => `${origin}${path}`))
  report.unexpectedRequests = [...new Set(requested
    .map(url => url.replace(/[?#].*$/, ''))
    .filter(url => !expected.has(url)))]
  /*
   * Anything the harness served that the browser never reported asking for. If
   * the request events were missing traffic, the check above would be blind to
   * the same extent, so this is recorded rather than filtered.
   */
  report.unservedMismatch = served
    .map(path => `${origin}${path}`)
    .filter(url => !requested.some(asked => asked.replace(/[?#].*$/, '') === url))

  await writeFile(runPath(browserName, report.pipelineId, report.fixture), `${JSON.stringify(report, null, 2)}\n`)
  return report
}

function jobsFor(pipelineEntry, fixtures) {
  return fixtures.filter(fixture => pipelineEntry.output === 'dom'
    || (PDF_SUBSET.includes(fixture.name) && fixture.expectation === 'convert'))
}

async function evaluateBrowser(name, port, served, fixtures, pipelines, prepared, verifierUrls) {
  const messages = []
  const recorded = await loadRuns(name)
  const runs = [...recorded]

  const probeBrowser = await LAUNCHERS[name]()
  const probePage = await openHarness(probeBrowser, port, messages)
  const environment = await probePage.evaluate('window.__environment()')
  await probeBrowser.close()

  for (const entry of pipelines) {
    const scripts = entry.libraries.map(id => prepared.get(id).urls.script)
    /*
     * A browser per pipeline. Pages are cheap to reopen, and a library that
     * held tens of megabytes of canvas only really gives them back when its
     * browser exits.
     */
    const browser = await LAUNCHERS[name]()
    try {
      for (const fixture of jobsFor(entry, fixtures)) {
        if (recorded.some(item => item.pipelineId === entry.id && item.fixture === fixture.name)) continue
        runs.push(await runJob(name, browser, port, served, messages, {
          pipeline: { id: entry.id, output: entry.output, libraries: entry.libraries, scripts },
          fixture: {
            name: fixture.name,
            url: `/fixtures/${fixture.filename}`,
            expectation: fixture.expectation,
            declared: fixture.declared,
          },
          raster: RASTER,
          measureMemory: environment.memoryApi === 'available' && MEMORY_SUBSET.includes(fixture.name),
          verifierUrls,
        }, `${name} · ${entry.id} · ${fixture.name}`))
      }
    }
    finally {
      await browser.close()
    }
  }

  return { browser: name, environment, pageErrors: [...new Set(messages)], runs: sortRuns(runs, fixtures, pipelines) }
}

function sortRuns(runs, fixtures, pipelines) {
  return [...runs].sort((left, right) => {
    const byPipeline = pipelines.findIndex(entry => entry.id === left.pipelineId)
      - pipelines.findIndex(entry => entry.id === right.pipelineId)
    if (byPipeline !== 0) return byPipeline
    return fixtures.findIndex(entry => entry.name === left.fixture)
      - fixtures.findIndex(entry => entry.name === right.fixture)
  })
}

async function main() {
  const browsers = argument('browsers', ['chromium', 'firefox', 'webkit'])
  const selectedPipelines = argument('pipelines', null)
  const selectedFixtures = argument('fixtures', null)

  await mkdir(WORK, { recursive: true })
  const files = new Map([['/harness.html', HARNESS]])

  process.stdout.write('corpus\n')
  const allFixtures = buildFixtures()
  const fixtures = selectedFixtures ? allFixtures.filter(fixture => selectedFixtures.includes(fixture.name)) : allFixtures
  const fixtureDirectory = join(WORK, 'fixtures')
  await mkdir(fixtureDirectory, { recursive: true })
  for (const fixture of allFixtures) {
    const path = join(fixtureDirectory, fixture.filename)
    await writeFile(path, fixture.bytes)
    files.set(`/fixtures/${fixture.filename}`, path)
  }
  process.stdout.write(`  ${allFixtures.length} documents across ${fixtureCategories.length} categories\n`)

  process.stdout.write('packages\n')
  const prepared = new Map()
  for (const library of libraries) {
    prepared.set(library.id, await prepareLibrary(library, files))
  }
  const verifierUrls = prepared.get(verifierId).urls

  const pipelines = selectedPipelines ? allPipelines.filter(entry => selectedPipelines.includes(entry.id)) : allPipelines

  const { server, served, port } = await startServer(files)
  const browserReports = []
  try {
    for (const name of browsers) {
      process.stdout.write(`${name}\n`)
      browserReports.push(await evaluateBrowser(name, port, served, fixtures, pipelines, prepared, verifierUrls))
    }
  }
  finally {
    server.close()
  }

  const measurements = {
    measuredAt: new Date().toISOString().slice(0, 10),
    host: { platform: process.platform, arch: process.arch, cpus: cpus().length },
    budgets,
    raster: RASTER,
    pdfSubset: PDF_SUBSET,
    memorySubset: MEMORY_SUBSET,
    /** The address the hyperlink document points at; no run may request it. */
    externalLinkProbe: EXTERNAL_LINK_PROBE,
    permittedLicences,
    /* The documents themselves stay in `artifacts/`; the record keeps their shape and digest. */
    fixtures: allFixtures.map(fixture => ({
      name: fixture.name,
      category: fixture.category,
      filename: fixture.filename,
      mediaType: fixture.mediaType,
      features: fixture.features,
      expectation: fixture.expectation,
      note: fixture.note,
      declared: fixture.declared,
      byteLength: fixture.byteLength,
      sha256: fixture.sha256,
    })),
    libraries: libraries.map(library => ({
      ...library,
      assets: prepared.get(library.id).assets,
      transfer: prepared.get(library.id).assets.reduce(
        (total, asset) => ({ bytes: total.bytes + asset.bytes, brotliBytes: total.brotliBytes + asset.brotliBytes }),
        { bytes: 0, brotliBytes: 0 },
      ),
    })),
    pipelines: allPipelines.map(entry => ({
      ...entry,
      transfer: entry.libraries.reduce((total, id) => {
        const assets = prepared.get(id).assets
        return {
          bytes: total.bytes + assets.reduce((sum, asset) => sum + asset.bytes, 0),
          brotliBytes: total.brotliBytes + assets.reduce((sum, asset) => sum + asset.brotliBytes, 0),
        }
      }, { bytes: 0, brotliBytes: 0 }),
    })),
    exclusions,
    browsers: browserReports,
  }

  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(measurements, null, 2)}\n`)
  process.stdout.write(`\nwrote ${OUTPUT}\n`)
}

await main()
