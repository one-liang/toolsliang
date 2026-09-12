/**
 * The plumbing every operator-run browser measurement needs.
 *
 * `evaluate-pdf-engine.mjs` and `evaluate-word-to-pdf.mjs` both do the same
 * four things before they can measure anything: fetch a pinned npm tarball and
 * prove it is the one the registry published, extract only the files a harness
 * will load, serve them from localhost under the headers the memory API
 * requires, and drive Playwright through a matrix while recording every request
 * the browser made. None of that is specific to PDFs or to Word, and three
 * copies of it was two too many.
 *
 * What stays in each evaluation script is the part that differs: what the
 * corpus is, what a job means, and what the result is called.
 *
 * `evaluate-background-removal.mjs` still carries its own copy. It downloads
 * model weights rather than npm tarballs and needs a visible GPU-backed
 * Chromium, so migrating it is a separate change that has to be verified by
 * re-running inference, not by replaying a cache.
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { brotliCompress, constants } from 'node:zlib'
import { chromium, firefox, webkit } from '@playwright/test'

const compress = promisify(brotliCompress)
const run = promisify(execFile)

export const launchers = {
  /* Visible, because `measureUserAgentSpecificMemory()` only samples a page a user could see. */
  chromium: () => chromium.launch({ headless: false }),
  firefox: () => firefox.launch(),
  webkit: () => webkit.launch(),
}

export async function sha256(path) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

export async function exists(path) {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}

/** npm publishes `sha512-<base64>`; the tarball is rejected when it does not match. */
export async function verifyIntegrity(path, integrity) {
  const [algorithm, expected] = integrity.split('-')
  const hash = createHash(algorithm)
  await pipeline(createReadStream(path), hash)
  const digest = hash.digest('base64')
  if (digest !== expected) throw new Error(`integrity_mismatch ${path}: expected ${expected}, measured ${digest}`)
}

export async function download(url, path) {
  await mkdir(dirname(path), { recursive: true })
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download_failed ${response.status} ${url}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(path))
}

/** Brotli at quality 5, the level a static host applies to a bundled asset. */
export async function transferSizes(path) {
  const raw = await readFile(path)
  const brotli = await compress(raw, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 5,
      [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  })
  return { bytes: raw.length, brotliBytes: brotli.length }
}

/**
 * Downloads one pinned package, checks it against the registry's integrity
 * string, extracts only the members the harness loads, and registers them on
 * the file map under `/lib/<id>/…`.
 *
 * Returns the routes the harness should be handed and the digest and transfer
 * size of every file, which the record publishes so a reader can re-check that
 * these were the bytes that ran.
 */
export async function preparePackage(entry, { workDirectory, files }) {
  const directory = join(workDirectory, 'packages', entry.id)
  const tarball = join(directory, 'package.tgz')
  const url = `https://registry.npmjs.org/${entry.package}/-/${entry.package.split('/').pop()}-${entry.version}.tgz`

  if (!await exists(tarball)) {
    process.stdout.write(`  downloading ${entry.package}@${entry.version}\n`)
    await download(url, tarball)
  }
  await verifyIntegrity(tarball, entry.integrity)

  const extracted = join(directory, 'files')
  const wanted = Object.values(entry.files)
  if (!await exists(join(extracted, wanted[0]))) {
    await mkdir(extracted, { recursive: true })
    await run('tar', ['xzf', tarball, '-C', extracted, ...wanted])
  }

  const urls = {}
  const assets = []
  for (const [role, member] of Object.entries(entry.files)) {
    const path = join(extracted, member)
    const route = `/lib/${entry.id}/${member.replace('package/', '')}`
    files.set(route, path)
    urls[role] = route
    assets.push({ role, file: member.replace('package/', ''), sha256: await sha256(path), ...await transferSizes(path) })
  }

  return { urls, assets }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.docm': 'application/vnd.ms-word.document.macroEnabled.12',
  '.doc': 'application/msword',
}

/**
 * Serves the file map from localhost. `served` collects every path that was
 * asked for: the per-job privacy check is made from the browser's own request
 * events, which see every origin, and this list is the cross-check that the two
 * agree about what the harness was asked for.
 */
export function startServer(files) {
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

/**
 * Opens the harness page and starts recording.
 *
 * The request listener is on the context and keeps full URLs: the server's own
 * log only sees what it was asked to serve, so a document that persuaded an
 * engine to fetch something elsewhere would leave no trace there. This sees
 * every request the browser makes, including from workers, to any origin.
 */
export async function openHarness(browser, port, messages, requested = [], { viewport } = {}) {
  const page = viewport ? await browser.newPage({ viewport }) : await browser.newPage()
  page.context().on('request', request => requested.push(request.url()))
  page.on('pageerror', error => messages.push(String(error).slice(0, 200)))
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text().slice(0, 200))
  })
  await page.goto(`http://127.0.0.1:${port}/harness.html`)
  await page.waitForFunction('window.__ready === true', null, { timeout: 60_000 })
  return page
}

/**
 * Runs one job in its own page and returns the report with the request audit
 * attached.
 *
 * `allowedPaths` is what this job had business asking for. Anything else — the
 * address a document points at, a library reaching past the files it was given
 * — is recorded rather than judged here. `onTimeout` supplies the report shape
 * the caller's record expects when a job never comes back.
 */
export async function runJob(browser, { port, served, messages, payload, allowedPaths, timeoutMs, onTimeout, viewport }) {
  served.length = 0
  const requested = []
  const page = await openHarness(browser, port, messages, requested, { viewport })
  await page.bringToFront()

  const started = Date.now()
  const report = await Promise.race([
    page.evaluate(job => window.__run(job), payload),
    new Promise(resolve => setTimeout(() => resolve(onTimeout()), timeoutMs)),
  ])
  report.wallClockMs = Date.now() - started
  await page.close()

  const origin = `http://127.0.0.1:${port}`
  const expected = new Set(allowedPaths.map(path => `${origin}${path}`))
  report.unexpectedRequests = [...new Set(requested
    .map(url => url.replace(/[?#].*$/, ''))
    .filter(url => !expected.has(url)))]
  /*
   * Anything the harness served that the browser never reported asking for. If
   * the request events were missing traffic, the check above would be blind to
   * the same extent, so this is recorded rather than filtered: the one entry it
   * ever contains is the favicon, which Chromium and Firefox fetch outside the
   * page's own request pipeline. Nothing is excluded here, so a second kind of
   * blind spot would show up instead of being swept away.
   */
  report.unservedMismatch = served
    .map(path => `${origin}${path}`)
    .filter(url => !requested.some(asked => asked.replace(/[?#].*$/, '') === url))

  return report
}

/** Every report already on disk for one browser, so an interrupted matrix resumes. */
export async function loadRuns(directory, browser) {
  await mkdir(directory, { recursive: true })
  const files = await readdir(directory)
  const runs = []
  for (const file of files.filter(name => name.startsWith(`${browser}__`) && name.endsWith('.json')).sort()) {
    runs.push(JSON.parse(await readFile(join(directory, file), 'utf8')))
  }
  return runs
}

export async function saveRun(path, report) {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`)
}

/** Reads the environment once per browser, in a throwaway instance. */
export async function probeEnvironment(name, port, messages) {
  const browser = await launchers[name]()
  try {
    const page = await openHarness(browser, port, messages)
    return await page.evaluate('window.__environment()')
  }
  finally {
    await browser.close()
  }
}
