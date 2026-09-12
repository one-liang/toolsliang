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
import { exclusions, libraries, permittedLicences, pipelines as allPipelines, verifierId } from './word-to-pdf/candidates.mjs'
import { EXTERNAL_LINK_PROBE, buildFixtures, fixtureCategories } from './word-to-pdf/fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'artifacts', 'word-to-pdf')
const OUTPUT = join(ROOT, 'docs', 'research', 'data', '011-word-to-pdf-measurements.json')
const HARNESS = join(ROOT, 'scripts', 'word-to-pdf', 'harness.html')

/**
 * The budgets §12.13 of the specification sets, in the units the harness
 * reports. They are handed to the harness as well as recorded with the results,
 * so the thresholds the runs were measured against and the thresholds the
 * record judges them by are the same numbers.
 */
const budgets = {
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

function argument(name, fallback) {
  const found = process.argv.find(entry => entry.startsWith(`--${name}=`))
  return found ? found.split('=').slice(1).join('=').split(',') : fallback
}

function runPath(browser, pipelineId, fixture) {
  return join(WORK, 'runs', `${browser}__${pipelineId}__${fixture}.json`)
}

function jobsFor(pipelineEntry, fixtures) {
  return fixtures.filter(fixture => pipelineEntry.output === 'dom'
    || (PDF_SUBSET.includes(fixture.name) && fixture.expectation === 'convert'))
}

async function evaluateBrowser(name, port, served, fixtures, pipelines, prepared, verifierUrls) {
  const messages = []
  const directory = join(WORK, 'runs')
  const recorded = await loadRuns(directory, name)
  const runs = [...recorded]

  const environment = await probeEnvironment(name, port, messages)

  for (const entry of pipelines) {
    const scripts = entry.libraries.map(id => prepared.get(id).urls.script)
    /*
     * A browser per pipeline. Pages are cheap to reopen, and a library that
     * held tens of megabytes of canvas only really gives them back when its
     * browser exits.
     */
    const browser = await launchers[name]()
    try {
      for (const fixture of jobsFor(entry, fixtures)) {
        if (recorded.some(item => item.pipelineId === entry.id && item.fixture === fixture.name)) continue

        const payload = {
          pipeline: { id: entry.id, parser: entry.parser, output: entry.output, libraries: entry.libraries, scripts },
          fixture: {
            name: fixture.name,
            url: `/fixtures/${fixture.filename}`,
            expectation: fixture.expectation,
            declared: fixture.declared,
          },
          raster: RASTER,
          budgets,
          measureMemory: environment.memoryApi === 'available' && MEMORY_SUBSET.includes(fixture.name),
          verifierUrls,
        }

        process.stdout.write(`  ${name} · ${entry.id} · ${fixture.name}\n`)
        const report = await runJob(browser, {
          port,
          served,
          messages,
          payload,
          viewport: { width: 1280, height: 900 },
          allowedPaths: ['/harness.html', '/favicon.ico', payload.fixture.url, ...scripts, ...Object.values(verifierUrls)],
          timeoutMs: JOB_TIMEOUT_MS,
          onTimeout: () => ({
            pipelineId: entry.id,
            fixture: fixture.name,
            output: entry.output,
            outcome: 'timeout',
            error: { name: 'Timeout', message: `job_timeout_after_${JOB_TIMEOUT_MS}ms` },
            stages: {},
          }),
        })
        await saveRun(runPath(name, report.pipelineId, report.fixture), report)
        runs.push(report)
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
    prepared.set(library.id, await preparePackage(library, { workDirectory: WORK, files }))
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
