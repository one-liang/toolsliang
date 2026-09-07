/**
 * Measures the T18 background-removal candidates in real browsers.
 *
 * Operators run this; CI never does. It downloads pinned model weights and a
 * pinned onnxruntime-web build into the ignored `artifacts/` directory, checks
 * every file against its recorded SHA-256, serves them from localhost and drives
 * Playwright through fixtures the page draws from code. No photograph, user file
 * or result leaves the machine: the only outbound requests are the pinned model
 * and runtime downloads, and they are skipped once the files are on disk.
 *
 *   node scripts/evaluate_background_removal.mjs [--browsers=chromium,firefox,webkit]
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { brotliCompress, constants } from 'node:zlib'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { chromium, firefox, webkit } from '@playwright/test'
import { candidates as allCandidates, runtime } from './background-removal/candidates.mjs'

/** `--candidates=` narrows a smoke run; the recorded matrix always runs them all. */
const selected = process.argv.find(argument => argument.startsWith('--candidates='))
const candidates = selected
  ? allCandidates.filter(candidate => selected.split('=')[1].split(',').includes(candidate.id))
  : allCandidates

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'artifacts', 'background-removal')
const OUTPUT = join(ROOT, 'docs', 'research', 'data', '007-background-removal-measurements.json')
const HARNESS = join(ROOT, 'scripts', 'background-removal', 'harness.html')

const compress = promisify(brotliCompress)

/** Small enough to keep every candidate comparable, large enough to show edges. */
const FIXTURE_SIZE = 768
const LARGE_FIXTURE = { name: 'product-bottle', width: 4000, height: 3000 }
const FIXTURE_NAMES = [
  'portrait-person',
  'fine-hair',
  'product-bottle',
  'semi-transparent-glass',
  'low-contrast-box',
]

/** The specification's cached desktop budget for one 12 MP result, §12.8. */
const DESKTOP_BUDGET_MS = 30000

/** No single candidate may stall the matrix; a run past this is recorded as timed out. */
const RUN_TIMEOUT_MS = 900000

/** Sampling memory blocks on garbage collection, so only these cases pay for it. */
const MEMORY_FIXTURES = ['product-bottle']

/** Firefox and WebKit confirm the contract; Chromium carries the full matrix. */
const CONFIRMATION_FIXTURES = ['portrait-person', 'product-bottle']

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
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

async function download(url, path) {
  await mkdir(dirname(path), { recursive: true })
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download_failed ${response.status} ${url}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(path))
}

async function ensureFile(url, path, expectedSha) {
  if (!await exists(path)) {
    process.stdout.write(`  downloading ${url}\n`)
    await download(url, path)
  }
  const digest = await sha256(path)
  if (expectedSha && digest !== expectedSha) {
    throw new Error(`digest_mismatch ${path}: expected ${expectedSha}, measured ${digest}`)
  }
  return digest
}

/** Brotli at quality 5, the level a static host applies to a large asset. */
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

function startServer(files) {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname
    const target = files.get(path)
    if (!target) {
      response.writeHead(404).end('not found')
      return
    }
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    response.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream')
    response.writeHead(200)
    await pipeline(createReadStream(target), response)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

const LAUNCHERS = {
  /*
   * Headed on purpose. Headless Chromium only offers a SwiftShader WebGPU
   * adapter and refuses `measureUserAgentSpecificMemory`, so a headless run
   * would report software timings and no memory at all.
   */
  chromium: () => chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] }),
  firefox: () => firefox.launch(),
  webkit: () => webkit.launch(),
}

function fixturesFor(browser, provider) {
  const names = browser === 'chromium' ? FIXTURE_NAMES : CONFIRMATION_FIXTURES
  const set = names.map(name => ({ name, width: FIXTURE_SIZE, height: FIXTURE_SIZE }))
  if (browser === 'chromium' && provider === 'wasm') set.push(LARGE_FIXTURE)
  return set
}

/**
 * Every run is written out the moment it finishes and read back on the next
 * start. A 224 MB model in a browser can exhaust the machine, and when the
 * operating system stops the process there is no reason to pay for the runs
 * that already succeeded.
 */
function runPath(browser, report) {
  const parts = [browser, report.candidateId, report.provider, report.configuration, report.inputWidth ?? 'native']
  return join(WORK, 'runs', `${parts.join('__')}.json`)
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

function alreadyRun(runs, candidateId, provider, configuration, inputWidth) {
  return runs.some(run => run.candidateId === candidateId
    && run.provider === provider
    && run.configuration === configuration
    && (run.inputWidth ?? null) === inputWidth)
}

/** An out-of-memory report is the one failure worth a second, leaner attempt. */
function ranOutOfMemory(report) {
  const messages = [report.failure?.message, ...report.fixtures.map(entry => entry.failure)]
  return messages.some(message => message && /bad_alloc|out of memory|allocate|OOM/i.test(message))
}

/** A candidate needs the degraded pass when it cannot finish at full size. */
function needsDegradedPass(report) {
  if (ranOutOfMemory(report)) return true
  const reference = report.fixtures.find(entry => entry.fixture === 'product-bottle' && entry.width === 768)
  return Boolean(reference?.inferenceMs && reference.inferenceMs > DESKTOP_BUDGET_MS)
}

async function runOnce(browser, port, messages, job, label, name) {
  process.stdout.write(`  ${label}\n`)
  job.memoryFixtures = MEMORY_FIXTURES
  const page = await openHarness(browser, port, messages)
  /* A hidden page may never collect garbage, and the memory sample waits for it. */
  await page.bringToFront()
  const started = Date.now()
  const report = await Promise.race([
    page.evaluate(input => window.__run(input), job),
    new Promise(resolve => setTimeout(
      () => resolve({
        candidateId: job.candidate.id,
        provider: job.provider,
        configuration: job.configuration,
        inputWidth: job.input?.width ?? job.candidate.input.width,
        inputHeight: job.input?.height ?? job.candidate.input.height,
        fixtures: [],
        failure: { stage: 'run', message: `run_timeout_after_${RUN_TIMEOUT_MS}ms` },
      }),
      RUN_TIMEOUT_MS,
    )),
  ])
  report.wallClockMs = Date.now() - started
  await page.close()
  await writeFile(runPath(name, report), `${JSON.stringify(report, null, 2)}\n`)
  return report
}

async function openHarness(browser, port, messages) {
  const page = await browser.newPage()
  page.on('pageerror', error => messages.push(String(error)))
  await page.goto(`http://127.0.0.1:${port}/harness.html`)
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 })
  return page
}

async function evaluateBrowser(name, port, models) {
  const messages = []
  const runs = await loadRuns(name)

  const probe = await LAUNCHERS[name]()
  const probePage = await openHarness(probe, port, messages)
  const environment = await probePage.evaluate('window.__environment()')
  await probe.close()

  const threads = Math.min(4, environment.hardwareConcurrency ?? 1)
  const providers = ['wasm']
  if (environment.webgpu?.available) providers.push('webgpu')

  for (const candidate of candidates) {
    for (const provider of providers) {
      /*
       * A browser per candidate. Pages are cheap to reopen and the previous
       * candidate's several hundred megabytes are only really returned to the
       * machine when its browser exits.
       */
      const browser = await LAUNCHERS[name]()
      try {
        const base = {
          candidate,
          provider,
          threads,
          modelUrl: models.get(candidate.id).url,
          fixtures: fixturesFor(name, provider),
        }

        let last = runs.find(run => run.candidateId === candidate.id
          && run.provider === provider
          && (run.inputWidth ?? candidate.input.width) === candidate.input.width)

        for (const configuration of ['default', 'memory-lean']) {
          if (alreadyRun(runs, candidate.id, provider, configuration, candidate.input.width)) continue
          last = await runOnce(browser, port, messages, { ...base, configuration },
            `${name} · ${candidate.id} · ${provider} · ${configuration}`, name)
          runs.push(last)
          if (!ranOutOfMemory(last)) break
        }

        /*
         * The degraded pass is the documented fallback: half the model's own
         * input edge, a quarter of the activation memory. It is only worth
         * measuring where the native resolution ran out of memory or missed
         * the desktop budget, so a healthy candidate costs nothing extra.
         */
        const degradedWidth = candidate.input.width / 2
        if (name === 'chromium' && last && needsDegradedPass(last)
          && !alreadyRun(runs, candidate.id, provider, 'memory-lean', degradedWidth)) {
          runs.push(await runOnce(browser, port, messages, {
            ...base,
            configuration: 'memory-lean',
            input: { width: degradedWidth, height: candidate.input.height / 2 },
          }, `${name} · ${candidate.id} · ${provider} · degraded`, name))
        }
      }
      finally {
        await browser.close()
      }
    }
  }

  return { browser: name, environment, threads, providers, pageErrors: messages, runs: sortRuns(runs) }
}

/** One stable order regardless of how many restarts produced the runs. */
function sortRuns(runs) {
  const order = ['default', 'memory-lean']
  return [...runs].sort((left, right) => {
    const byCandidate = candidates.findIndex(entry => entry.id === left.candidateId)
      - candidates.findIndex(entry => entry.id === right.candidateId)
    if (byCandidate !== 0) return byCandidate
    if (left.provider !== right.provider) return left.provider < right.provider ? -1 : 1
    if (left.inputWidth !== right.inputWidth) return (right.inputWidth ?? 0) - (left.inputWidth ?? 0)
    return order.indexOf(left.configuration) - order.indexOf(right.configuration)
  })
}

async function main() {
  const requested = process.argv.find(argument => argument.startsWith('--browsers='))
  const browsers = (requested ? requested.split('=')[1] : 'chromium,firefox,webkit').split(',')

  await mkdir(WORK, { recursive: true })
  const files = new Map([['/harness.html', HARNESS]])

  process.stdout.write(`onnxruntime-web ${runtime.version}\n`)
  const runtimeFiles = []
  for (const file of runtime.files) {
    const path = join(WORK, 'ort', file)
    const digest = await ensureFile(`${runtime.base}${file}`, path, null)
    files.set(`/ort/${file}`, path)
    runtimeFiles.push({ file, sha256: digest, ...await transferSizes(path) })
  }

  const models = new Map()
  for (const candidate of candidates) {
    const path = join(WORK, 'models', `${candidate.id}.onnx`)
    const url = `https://huggingface.co/${candidate.repo}/resolve/${candidate.revision}/${candidate.file}`
    process.stdout.write(`${candidate.id}\n`)
    await ensureFile(url, path, candidate.sha256)
    const sizes = await transferSizes(path)
    files.set(`/models/${candidate.id}.onnx`, path)
    models.set(candidate.id, { url: `/models/${candidate.id}.onnx`, sizes })
  }

  const { server, port } = await startServer(files)
  const browserReports = []
  try {
    for (const name of browsers) {
      process.stdout.write(`${name}\n`)
      browserReports.push(await evaluateBrowser(name, port, models))
    }
  }
  finally {
    server.close()
  }

  const measurements = {
    measuredAt: new Date().toISOString().slice(0, 10),
    host: { platform: process.platform, arch: process.arch, cpus: (await import('node:os')).cpus().length },
    runtime: { ...runtime, files: runtimeFiles },
    fixtures: { size: FIXTURE_SIZE, names: FIXTURE_NAMES, large: LARGE_FIXTURE, confirmation: CONFIRMATION_FIXTURES },
    candidates: candidates.map(candidate => ({
      ...candidate,
      transfer: models.get(candidate.id).sizes,
    })),
    browsers: browserReports,
  }

  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(measurements, null, 2)}\n`)
  process.stdout.write(`wrote ${OUTPUT}\n`)
}

await main()
