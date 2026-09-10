/**
 * Measures the T24 PDF engine candidates in real browsers.
 *
 * Operators run this; CI never does. It downloads the pinned npm tarballs into
 * the ignored `artifacts/` directory, checks each against the integrity string
 * the registry published for that version, extracts only the files the harness
 * loads, builds the representative documents from code, serves everything from
 * localhost and drives Playwright through the matrix.
 *
 * No PDF, page, signature or result leaves the machine: the fixtures are
 * written by `scripts/pdf-engine/fixtures.mjs`, and the only outbound requests
 * are the pinned package downloads, which are skipped once the files are on
 * disk.
 *
 *   node scripts/evaluate-pdf-engine.mjs [--browsers=chromium,firefox,webkit]
 *                                        [--candidates=pdf-lib,pdfjs-dist]
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
import { candidates as allCandidates, exclusions, permittedLicences } from './pdf-engine/candidates.mjs'
import { buildFixtures, fixturePassword } from './pdf-engine/fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'artifacts', 'pdf-engine')
const OUTPUT = join(ROOT, 'docs', 'research', 'data', '009-pdf-engine-measurements.json')
const HARNESS = join(ROOT, 'scripts', 'pdf-engine', 'harness.html')

const compress = promisify(brotliCompress)
const run = promisify(execFile)

/** The preview zoom the workspace would open a page at. */
const PREVIEW_SCALE = 1.5

/** No single job may stall the matrix; past this the run is recorded as timed out. */
const JOB_TIMEOUT_MS = 180_000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
}

const selected = process.argv.find(argument => argument.startsWith('--candidates='))
const candidates = selected
  ? allCandidates.filter(candidate => selected.split('=')[1].split(',').includes(candidate.id))
  : allCandidates

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

async function prepareCandidate(candidate, files) {
  const directory = join(WORK, 'packages', candidate.id)
  const tarball = join(directory, 'package.tgz')
  const url = `https://registry.npmjs.org/${candidate.package}/-/${candidate.package.split('/').pop()}-${candidate.version}.tgz`

  if (!await exists(tarball)) {
    process.stdout.write(`  downloading ${candidate.package}@${candidate.version}\n`)
    await download(url, tarball)
  }
  await verifyIntegrity(tarball, candidate.integrity)

  const extracted = join(directory, 'files')
  const wanted = Object.values(candidate.files)
  if (!await exists(join(extracted, wanted[0]))) {
    await mkdir(extracted, { recursive: true })
    await run('tar', ['xzf', tarball, '-C', extracted, ...wanted])
  }

  const served = {}
  const assets = []
  for (const [role, member] of Object.entries(candidate.files)) {
    const path = join(extracted, member)
    const route = `/lib/${candidate.id}/${member.replace('package/', '')}`
    files.set(route, path)
    served[role] = route
    assets.push({ role, file: member.replace('package/', ''), sha256: await sha256(path), ...await transferSizes(path) })
  }

  return { urls: served, assets }
}

function startServer(files) {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname
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
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

const LAUNCHERS = {
  chromium: () => chromium.launch({ headless: false }),
  firefox: () => firefox.launch(),
  webkit: () => webkit.launch(),
}

/**
 * The jobs one candidate runs. A password fixture is opened twice on purpose:
 * once with nothing, to record what the library says when it cannot open the
 * file, and once with the password, to record whether it can at all.
 */
function jobsFor(candidate, fixtures) {
  const jobs = []
  for (const fixture of fixtures) {
    const operations = ['open']
    if (candidate.roles.includes('preview')) operations.push('preview')
    if (candidate.roles.includes('write')) operations.push('apply', 'verify')

    jobs.push({ fixture, operations, variant: 'default', password: undefined })

    /* Appending the change instead of rewriting the file is the shape a
     * signature wants; only the maintained fork offers it. */
    if (candidate.id === 'cantoo-pdf-lib' && fixture.expectation === 'open') {
      jobs.push({ fixture, operations, variant: 'incremental', password: undefined })
    }

    if (fixture.expectation === 'password') {
      jobs.push({
        fixture,
        operations,
        variant: 'with-password',
        password: fixturePassword,
        verifyPassword: fixturePassword,
      })
      /*
       * pdf-lib's documented way past an encrypted file. The record has to say
       * what it actually produces, because "it opened" is not the same as "the
       * exported document is readable" — so the export is read back with the
       * password as well, which is the most any reader could bring to it.
       */
      if (candidate.roles.includes('write') && !candidate.roles.includes('password')) {
        jobs.push({
          fixture,
          operations,
          variant: 'ignore-encryption',
          password: undefined,
          verifyPassword: fixturePassword,
        })
      }
    }
  }
  return jobs
}

function runPath(browser, candidateId, fixture, variant) {
  return join(WORK, 'runs', `${browser}__${candidateId}__${fixture}__${variant}.json`)
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

async function openHarness(browser, port, messages) {
  const page = await browser.newPage()
  page.on('pageerror', error => messages.push(String(error).slice(0, 200)))
  page.on('console', message => {
    if (message.type() === 'error') messages.push(message.text().slice(0, 200))
  })
  await page.goto(`http://127.0.0.1:${port}/harness.html`)
  await page.waitForFunction('window.__ready === true', null, { timeout: 60_000 })
  return page
}

async function runJob(browserName, browser, port, messages, payload, label) {
  process.stdout.write(`  ${label}\n`)
  const page = await openHarness(browser, port, messages)
  await page.bringToFront()

  const started = Date.now()
  const report = await Promise.race([
    page.evaluate(job => window.__run(job), payload),
    new Promise(resolve => setTimeout(() => resolve({
      candidateId: payload.candidate.id,
      fixture: payload.fixture.name,
      variant: payload.variant,
      outcome: 'timeout',
      error: { name: 'Timeout', message: `job_timeout_after_${JOB_TIMEOUT_MS}ms` },
      stages: {},
    }), JOB_TIMEOUT_MS)),
  ])
  report.wallClockMs = Date.now() - started
  await page.close()
  await writeFile(runPath(browserName, report.candidateId, report.fixture, report.variant), `${JSON.stringify(report, null, 2)}\n`)
  return report
}

async function evaluateBrowser(name, port, fixtures, prepared, verifierUrls) {
  const messages = []
  const recorded = await loadRuns(name)
  const runs = [...recorded]

  const probeBrowser = await LAUNCHERS[name]()
  const probePage = await openHarness(probeBrowser, port, messages)
  const environment = await probePage.evaluate('window.__environment()')
  await probeBrowser.close()

  const measureMemory = environment.memoryApi === 'available'

  for (const candidate of candidates) {
    /*
     * A browser per candidate. Pages are cheap to reopen, and a library that
     * held tens of megabytes only really gives them back when its browser exits.
     */
    const browser = await LAUNCHERS[name]()
    try {
      for (const job of jobsFor(candidate, fixtures)) {
        const already = recorded.find(entry => entry.candidateId === candidate.id
          && entry.fixture === job.fixture.name && entry.variant === job.variant)
        if (already) continue

        runs.push(await runJob(name, browser, port, messages, {
          candidate: { id: candidate.id, urls: prepared.get(candidate.id).urls },
          fixture: { name: job.fixture.name, url: `/fixtures/${job.fixture.name}.pdf`, expectation: job.fixture.expectation },
          operations: job.operations,
          variant: job.variant,
          password: job.password,
          verifyPassword: job.verifyPassword,
          scale: PREVIEW_SCALE,
          measureMemory,
          verifierUrls,
        }, `${name} · ${candidate.id} · ${job.fixture.name} · ${job.variant}`))
      }
    }
    finally {
      await browser.close()
    }
  }

  return { browser: name, environment, pageErrors: [...new Set(messages)], runs: sortRuns(runs, fixtures) }
}

function sortRuns(runs, fixtures) {
  const variants = ['default', 'incremental', 'with-password', 'ignore-encryption']
  return [...runs].sort((left, right) => {
    const byCandidate = allCandidates.findIndex(entry => entry.id === left.candidateId)
      - allCandidates.findIndex(entry => entry.id === right.candidateId)
    if (byCandidate !== 0) return byCandidate
    const byFixture = fixtures.findIndex(entry => entry.name === left.fixture)
      - fixtures.findIndex(entry => entry.name === right.fixture)
    if (byFixture !== 0) return byFixture
    return variants.indexOf(left.variant) - variants.indexOf(right.variant)
  })
}

async function main() {
  const requested = process.argv.find(argument => argument.startsWith('--browsers='))
  const browsers = (requested ? requested.split('=')[1] : 'chromium,firefox,webkit').split(',')

  await mkdir(WORK, { recursive: true })
  const files = new Map([['/harness.html', HARNESS]])

  process.stdout.write('fixtures\n')
  const fixtures = buildFixtures()
  const fixtureDirectory = join(WORK, 'fixtures')
  await mkdir(fixtureDirectory, { recursive: true })
  for (const fixture of fixtures) {
    const path = join(fixtureDirectory, `${fixture.name}.pdf`)
    await writeFile(path, fixture.bytes)
    files.set(`/fixtures/${fixture.name}.pdf`, path)
    process.stdout.write(`  ${fixture.name} ${(fixture.byteLength / 1048576).toFixed(2)} MiB\n`)
  }

  process.stdout.write('packages\n')
  const prepared = new Map()
  for (const candidate of allCandidates) {
    prepared.set(candidate.id, await prepareCandidate(candidate, files))
  }

  /* pdf.js reads every export back. It is a candidate as well, but here it is
   * the independent reader that says whether a written file is still a PDF. */
  const verifierUrls = prepared.get('pdfjs-dist').urls

  const { server, port } = await startServer(files)
  const browserReports = []
  try {
    for (const name of browsers) {
      process.stdout.write(`${name}\n`)
      browserReports.push(await evaluateBrowser(name, port, fixtures, prepared, verifierUrls))
    }
  }
  finally {
    server.close()
  }

  const measurements = {
    measuredAt: new Date().toISOString().slice(0, 10),
    host: { platform: process.platform, arch: process.arch, cpus: cpus().length },
    previewScale: PREVIEW_SCALE,
    permittedLicences,
    /* The documents themselves stay in `artifacts/`; the record keeps their shape and digest. */
    fixtures: fixtures.map(fixture => ({
      name: fixture.name,
      structure: fixture.structure,
      expectation: fixture.expectation,
      pages: fixture.pages,
      note: fixture.note,
      byteLength: fixture.byteLength,
      sha256: fixture.sha256,
    })),
    candidates: allCandidates.map(candidate => ({
      ...candidate,
      assets: prepared.get(candidate.id).assets,
      transfer: prepared.get(candidate.id).assets.reduce(
        (total, asset) => ({ bytes: total.bytes + asset.bytes, brotliBytes: total.brotliBytes + asset.brotliBytes }),
        { bytes: 0, brotliBytes: 0 },
      ),
    })),
    exclusions,
    browsers: browserReports,
  }

  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(measurements, null, 2)}\n`)
  process.stdout.write(`\nwrote ${OUTPUT}\n`)
}

await main()
