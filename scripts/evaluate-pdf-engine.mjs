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
import { mkdir, writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  launchers,
  loadRuns,
  preparePackage,
  probeEnvironment,
  runJob,
  saveRun,
  startServer,
} from './support/measurement-harness.mjs'
import { candidates as allCandidates, exclusions, permittedLicences } from './pdf-engine/candidates.mjs'
import { ACTIVE_CONTENT_PROBE, buildFixtures, fixtureOwnerPassword, fixturePassword } from './pdf-engine/fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'artifacts', 'pdf-engine')
const OUTPUT = join(ROOT, 'docs', 'research', 'data', '009-pdf-engine-measurements.json')
const HARNESS = join(ROOT, 'scripts', 'pdf-engine', 'harness.html')
const PLACEMENT = join(ROOT, 'scripts', 'pdf-engine', 'placement.mjs')

/** The preview zoom the workspace would open a page at. */
const PREVIEW_SCALE = 1.5

/** No single job may stall the matrix; past this the run is recorded as timed out. */
const JOB_TIMEOUT_MS = 180_000

const selected = process.argv.find(argument => argument.startsWith('--candidates='))
const candidates = selected
  ? allCandidates.filter(candidate => selected.split('=')[1].split(',').includes(candidate.id))
  : allCandidates

/**
 * The password a document opens with, or `undefined` when it needs none. The
 * restricted document's user password is the empty string: it opens in a viewer
 * without a prompt, and a library that refuses it is refusing something the
 * user considers unprotected.
 */
function openPasswordFor(fixture) {
  if (fixture.expectation === 'password') return fixturePassword
  if (fixture.name === 'owner-password-restricted') return ''
  return undefined
}

/**
 * The jobs one candidate runs. A protected document is opened twice on purpose:
 * once with nothing, to record what the library says when it cannot open the
 * file, and once with the password, to record whether it can at all.
 */
function jobsFor(candidate, fixtures) {
  const jobs = []
  for (const fixture of fixtures) {
    const operations = ['open']
    if (candidate.roles.includes('preview')) operations.push('preview')
    if (candidate.roles.includes('write')) operations.push('apply', 'verify')

    const password = openPasswordFor(fixture)
    jobs.push({ fixture, operations, variant: 'default', password: undefined })

    if (password !== undefined) {
      jobs.push({ fixture, operations, variant: 'with-password', password, verifyPassword: password })
    }

    /*
     * Appending the change instead of rewriting the file is the shape a
     * signature wants; only the maintained fork offers it. It has to be measured
     * on the protected documents too: an appended update leaves the original
     * `/Encrypt` behind an older trailer, and what a reader then does with the
     * appended objects is exactly what the export mode depends on.
     */
    if (candidate.id === 'cantoo-pdf-lib' && fixture.expectation !== 'reject') {
      jobs.push({ fixture, operations, variant: 'incremental', password, verifyPassword: password })
    }

    /*
     * pdf-lib's documented way past an encrypted file. The record has to say
     * what it actually produces, because "it opened" is not the same as "the
     * exported document is readable" — so the export is read back with the
     * password as well, which is the most any reader could bring to it.
     */
    if (password !== undefined && candidate.roles.includes('write') && !candidate.roles.includes('password')) {
      jobs.push({ fixture, operations, variant: 'ignore-encryption', password: undefined, verifyPassword: password })
    }
  }
  return jobs
}

function runPath(browser, candidateId, fixture, variant) {
  return join(WORK, 'runs', `${browser}__${candidateId}__${fixture}__${variant}.json`)
}

async function evaluateBrowser(name, port, served, fixtures, prepared, verifierUrls) {
  const messages = []
  const directory = join(WORK, 'runs')
  const recorded = await loadRuns(directory, name)
  const runs = [...recorded]

  const environment = await probeEnvironment(name, port, messages)
  const measureMemory = environment.memoryApi === 'available'

  for (const candidate of candidates) {
    /*
     * A browser per candidate. Pages are cheap to reopen, and a library that
     * held tens of megabytes only really gives them back when its browser exits.
     */
    const browser = await launchers[name]()
    try {
      for (const job of jobsFor(candidate, fixtures)) {
        const already = recorded.find(entry => entry.candidateId === candidate.id
          && entry.fixture === job.fixture.name && entry.variant === job.variant)
        if (already) continue

        const payload = {
          candidate: { id: candidate.id, roles: candidate.roles, urls: prepared.get(candidate.id).urls },
          fixture: { name: job.fixture.name, url: `/fixtures/${job.fixture.name}.pdf`, expectation: job.fixture.expectation },
          operations: job.operations,
          variant: job.variant,
          password: job.password,
          verifyPassword: job.verifyPassword,
          scale: PREVIEW_SCALE,
          measureMemory,
          verifierUrls,
        }

        process.stdout.write(`  ${name} · ${candidate.id} · ${job.fixture.name} · ${job.variant}\n`)
        const report = await runJob(browser, {
          port,
          served,
          messages,
          payload,
          allowedPaths: ['/harness.html', '/favicon.ico', '/lib/harness/placement.mjs',
            payload.fixture.url, ...Object.values(payload.candidate.urls), ...Object.values(verifierUrls)],
          timeoutMs: JOB_TIMEOUT_MS,
          onTimeout: () => ({
            candidateId: candidate.id,
            fixture: job.fixture.name,
            variant: job.variant,
            outcome: 'timeout',
            error: { name: 'Timeout', message: `job_timeout_after_${JOB_TIMEOUT_MS}ms` },
            stages: {},
          }),
        })
        await saveRun(runPath(name, report.candidateId, report.fixture, report.variant), report)
        runs.push(report)
      }
    }
    finally {
      await browser.close()
    }
  }

  return { browser: name, environment, pageErrors: [...new Set(messages)], runs: sortRuns(runs, fixtures) }
}

function sortRuns(runs, fixtures) {
  const variants = ['default', 'with-password', 'incremental', 'ignore-encryption']
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
  const requestedBrowsers = process.argv.find(argument => argument.startsWith('--browsers='))
  const browsers = (requestedBrowsers ? requestedBrowsers.split('=')[1] : 'chromium,firefox,webkit').split(',')

  await mkdir(WORK, { recursive: true })
  const files = new Map([['/harness.html', HARNESS], ['/lib/harness/placement.mjs', PLACEMENT]])

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
    prepared.set(candidate.id, await preparePackage(candidate, { workDirectory: WORK, files }))
  }

  /* pdf.js reads every export back. It is a candidate as well, but here it is
   * the independent reader that says whether a written file is still a PDF. */
  const verifierUrls = prepared.get('pdfjs-dist').urls

  const { server, served, port } = await startServer(files)
  const browserReports = []
  try {
    for (const name of browsers) {
      process.stdout.write(`${name}\n`)
      browserReports.push(await evaluateBrowser(name, port, served, fixtures, prepared, verifierUrls))
    }
  }
  finally {
    server.close()
  }

  const measurements = {
    measuredAt: new Date().toISOString().slice(0, 10),
    host: { platform: process.platform, arch: process.arch, cpus: cpus().length },
    previewScale: PREVIEW_SCALE,
    /** The address the active-content document points at; no run may request it. */
    activeContentProbe: ACTIVE_CONTENT_PROBE,
    passwords: { user: fixturePassword, owner: fixtureOwnerPassword },
    permittedLicences,
    /* The documents themselves stay in `artifacts/`; the record keeps their shape and digest. */
    fixtures: fixtures.map(fixture => ({
      name: fixture.name,
      structure: fixture.structure,
      expectation: fixture.expectation,
      encrypted: fixture.encrypted,
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
