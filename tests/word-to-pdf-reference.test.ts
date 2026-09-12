import { describe, expect, it } from 'vitest'
import {
  getPublicToolRoutes,
  getTool,
  publishedTools,
  searchTools,
  siteOrigin,
  supportedLocales,
  unpublishedToolSlugs,
} from '@/features/tools/catalog'
import { renderToolSitemap } from '@/features/tools/sitemap'
import {
  wordToPdfBudgets,
  wordToPdfCorpusRequirements,
  wordToPdfDecision,
  wordToPdfExclusionReasons,
  wordToPdfExclusions,
  wordToPdfForbiddenSurfaces,
  wordToPdfForbiddenWording,
  wordToPdfGateKeys,
  wordToPdfGates,
  wordToPdfLibraries,
  wordToPdfLibraryStages,
  wordToPdfPermittedLicences,
  wordToPdfPipelines,
  wordToPdfPublicationAllowed,
  wordToPdfReassessmentConditions,
  wordToPdfReferenceVersion,
  wordToPdfReservedSlug,
  redistributableWordToPdfLibraries,
} from '@/features/tools/word-to-pdf/domain/reference'
import {
  browserNames,
  everyRun,
  measuredBrowser,
  measuredFixture,
  measuredLibrary,
  measuredRun,
  optionalRun,
  parseBudgets,
  parseExclusions,
  parseFidelityRows,
  parseFixtures,
  parseForbiddenSurfaces,
  parseForbiddenWording,
  parseGates,
  parseLibraries,
  parseOutputRows,
  parsePaginationRows,
  parsePipelines,
  parseReassessmentConditions,
  parseTimings,
  parseVerdicts,
  sectionBody,
  verdictOf,
  wordToPdfDecisionRecord as record,
  wordToPdfMeasurements as measurements,
} from './support/word-to-pdf-decision-record'

/**
 * Package downloads, specifications and documentation; nothing about a document
 * ever may be sent. `stuk.github.io` is here because §4.1 quotes the error
 * message JSZip produces, and that message names its own documentation page —
 * which is part of why the message is unfit to show a user.
 */
const allowedHosts = [
  'registry.npmjs.org',
  'www.npmjs.com',
  'github.com',
  'stuk.github.io',
  'ecma-international.org',
  'www.iso.org',
  'developer.mozilla.org',
]

describe('vocabulary matches the decision record', () => {
  it('publishes exactly the documented libraries', () => {
    expect(wordToPdfLibraries.map(library => library.id)).toEqual(parseLibraries().map(row => row.id))
  })

  it('repeats each library\'s package, version and licence verbatim', () => {
    for (const row of parseLibraries()) {
      const library = wordToPdfLibraries.find(entry => entry.id === row.id)
      expect(library, `${row.id} missing from the reference module`).toBeDefined()
      expect(library).toMatchObject({
        package: row.package,
        version: row.version,
        licence: row.licence,
        licenceVerified: row.licenceVerified,
        licenceUrl: row.licenceUrl,
      })
    }
  })

  it('publishes exactly the documented pipelines and their composition', () => {
    const documented = parsePipelines()
    expect(wordToPdfPipelines.map(entry => entry.id)).toEqual(documented.map(row => row.id))
    for (const row of documented) {
      const entry = wordToPdfPipelines.find(pipeline => pipeline.id === row.id)!
      expect(entry.output).toBe(row.output)
      expect([...entry.libraries]).toEqual(row.libraries)
    }
  })

  it('publishes exactly the documented exclusions and their reasons', () => {
    const documented = parseExclusions()
    expect(wordToPdfExclusions.map(entry => entry.id)).toEqual(documented.map(row => row.id))
    for (const row of documented) {
      const entry = wordToPdfExclusions.find(exclusion => exclusion.id === row.id)!
      expect(entry.package).toBe(row.package)
      expect(entry.reason).toBe(row.reason)
    }
    expect([...wordToPdfExclusionReasons].sort()).toEqual([...new Set(documented.map(row => row.reason))].sort())
  })

  it('publishes exactly the documented gates, in order', () => {
    const documented = parseGates()
    expect([...wordToPdfGateKeys]).toEqual(documented.map(row => row.key))
    for (const row of documented) {
      expect(wordToPdfGates.find(gate => gate.key === row.key)?.verdict).toBe(row.verdict)
    }
  })

  it('publishes exactly the documented forbidden surfaces and reassessment conditions', () => {
    expect([...wordToPdfForbiddenSurfaces]).toEqual(parseForbiddenSurfaces())
    expect(wordToPdfReassessmentConditions.map(entry => entry.key)).toEqual(parseReassessmentConditions())
  })

  it('publishes exactly the documented budgets', () => {
    for (const row of parseBudgets()) {
      expect(wordToPdfBudgets[row.key as keyof typeof wordToPdfBudgets], row.key).toBe(row.value)
    }
  })

  it('names the version the measurements were taken under', () => {
    expect(wordToPdfReferenceVersion).toBe(`word-to-pdf-${measurements.measuredAt}`)
    expect(record).toContain(wordToPdfReferenceVersion)
  })

  it('only calls a library redistributable when its licence is permitted and verified', () => {
    expect([...wordToPdfPermittedLicences]).toEqual(measurements.permittedLicences)
    for (const library of redistributableWordToPdfLibraries) {
      expect(library.licenceVerified, library.id).toBe(true)
      expect(wordToPdfPermittedLicences as readonly string[]).toContain(library.licence)
    }
  })

  it('gives every library a stage the vocabulary knows', () => {
    for (const library of wordToPdfLibraries) {
      for (const stage of library.stages) expect(wordToPdfLibraryStages).toContain(stage)
    }
  })
})

describe('the record matches what was measured', () => {
  it('repeats each library\'s pinned version and integrity from the measurement file', () => {
    for (const library of wordToPdfLibraries) {
      const measured = measuredLibrary(library.id)
      expect(measured.version).toBe(library.version)
      expect(measured.licence).toBe(library.licence)
      expect(measured.licenceVerified).toBe(library.licenceVerified)
    }
  })

  it('repeats each pipeline\'s transfer size from the measurement file', () => {
    for (const row of parsePipelines()) {
      const measured = measurements.pipelines.find(entry => entry.id === row.id)!
      expect(Math.round(measured.transfer.brotliBytes / 1024), row.id).toBe(row.brotliBytes)
    }
  })

  it('repeats every corpus document\'s digest and size from the measurement file', () => {
    const documented = parseFixtures()
    expect(documented.map(row => row.name)).toEqual(measurements.fixtures.map(fixture => fixture.name))
    for (const row of documented) {
      const fixture = measuredFixture(row.name)
      expect(fixture.sha256, row.name).toBe(row.sha256)
      expect(fixture.byteLength, row.name).toBe(row.byteLength)
      expect(fixture.category, row.name).toBe(row.category)
      expect(fixture.expectation, row.name).toBe(row.expectation)
      expect(fixture.declared.pages, row.name).toBe(row.declaredPages)
    }
  })

  it('repeats every open verdict from the measurement file', () => {
    for (const row of parseVerdicts('### 4.1 開啟判定')) {
      for (const browser of browserNames) {
        expect(verdictOf(measuredRun(browser, row.pipelineId, row.fixture)), `${row.pipelineId}/${row.fixture}/${browser}`)
          .toBe(row.verdicts[browser])
      }
    }
  })

  it('repeats every page count from the measurement file', () => {
    for (const row of parsePaginationRows()) {
      expect(measuredFixture(row.fixture).declared.pages, row.fixture).toBe(row.declaredPages)
      for (const browser of browserNames) {
        expect(measuredRun(browser, 'docx-preview', row.fixture).probe?.renderedPages, `${row.fixture}/${browser}`)
          .toBe(row.rendered[browser])
      }
    }
  })

  it('repeats every timing and stall from the measurement file', () => {
    for (const row of parseTimings()) {
      const run = measuredRun(row.browser, row.pipelineId, row.fixture)
      expect(run.stages.firstObservableMs, `${row.fixture}/${row.browser} first observable`).toBe(row.firstObservableMs)
      expect(run.stages.conversionMs, `${row.fixture}/${row.browser} conversion`).toBe(row.conversionMs)
      expect(run.longestStallMs, `${row.fixture}/${row.browser} stall`).toBe(row.longestStallMs)
      expect(row.memoryMiB === null ? null : Math.round((run.memory?.peakBytes ?? 0) / 1048576), `${row.fixture}/${row.browser} memory`)
        .toBe(row.memoryMiB)
    }
  })

  it('repeats every produced file\'s shape from the measurement file', () => {
    for (const row of parseOutputRows()) {
      const run = measuredRun(row.browser, row.pipelineId, row.fixture)
      expect(measuredFixture(row.fixture).declared.pages, row.fixture).toBe(row.declaredPages)
      expect(run.pdf?.writtenPages, `${row.pipelineId}/${row.fixture}/${row.browser} pages`).toBe(row.writtenPages)
      expect(run.readBack?.readable, `${row.pipelineId}/${row.fixture}/${row.browser} readable`).toBe(row.readable)
      expect(run.readBack?.textItems, `${row.pipelineId}/${row.fixture}/${row.browser} text items`).toBe(row.textItems)
    }
  })
})

describe('the corpus is the one the specification asks for', () => {
  it('covers at least thirty documents', () => {
    expect(measurements.fixtures.length).toBeGreaterThanOrEqual(wordToPdfCorpusRequirements.minimumDocuments)
  })

  it('covers every content kind §12.13 names', () => {
    const covered = new Set(measurements.fixtures.flatMap(fixture => fixture.features))
    for (const feature of wordToPdfCorpusRequirements.features) {
      expect(covered, feature).toContain(feature)
    }
  })

  it('declares a document that has to be refused for every unsupported container', () => {
    const refused = measurements.fixtures.filter(fixture => fixture.expectation === 'refuse')
    expect(refused.map(fixture => fixture.name).sort()).toEqual([...wordToPdfCorpusRequirements.refusedDocuments].sort())
  })

  it('builds every document from code, so nobody\'s file is in the repository', () => {
    for (const fixture of measurements.fixtures) {
      expect(fixture.sha256, fixture.name).toMatch(/^[0-9a-f]{64}$/)
      expect(fixture.byteLength, fixture.name).toBeGreaterThan(0)
    }
  })
})

describe('nothing left the device', () => {
  it('never requested anything the job did not need', () => {
    for (const { browser, run } of everyRun()) {
      expect(run.unexpectedRequests ?? [], `${browser}/${run.pipelineId}/${run.fixture}`).toEqual([])
    }
  })

  it('never followed the address the corpus document points at', () => {
    const probe = measurements.externalLinkProbe
    for (const { browser, run } of everyRun()) {
      expect((run.unexpectedRequests ?? []).some(url => url.includes(probe)), `${browser}/${run.fixture}`).toBe(false)
    }
  })

  it('cites only sources that could never carry a document', () => {
    /* The corpus's own unreachable probe is an address on purpose; it is never a citation. */
    const probeHost = new URL(measurements.externalLinkProbe).host
    for (const [, host] of record.matchAll(/https?:\/\/([^/\s)>]+)/g)) {
      if (host === probeHost) continue
      expect(allowedHosts, host).toContain(host)
    }
    expect(probeHost).toMatch(/\.invalid$/)
  })
})

describe('the gate decides publication', () => {
  it('reaches no-go exactly when a gate failed', () => {
    const failed = wordToPdfGates.some(gate => gate.verdict === 'fail')
    expect(wordToPdfDecision).toBe(failed ? 'no-go' : 'go')
  })

  it('states the same decision in the record and the ADR', () => {
    expect(sectionBody('## 8. Go／No-Go 判定')).toContain(`**${wordToPdfDecision}**`)
  })

  it('allows no publication while the decision is no-go', () => {
    expect(wordToPdfDecision).toBe('no-go')
    expect(wordToPdfPublicationAllowed()).toBe(false)
  })

  it('reserves the slug without publishing it', () => {
    expect(wordToPdfReservedSlug).toBe('word-to-pdf')
    expect(unpublishedToolSlugs).toContain(wordToPdfReservedSlug)
    expect(publishedTools.map(tool => tool.slug)).not.toContain(wordToPdfReservedSlug)
    expect(getTool(wordToPdfReservedSlug)).toBeUndefined()
  })

  it('keeps the reserved slug off every surface §9.2 forbids', () => {
    for (const route of getPublicToolRoutes()) expect(route).not.toContain(wordToPdfReservedSlug)
    expect(renderToolSitemap(siteOrigin)).not.toContain(wordToPdfReservedSlug)
    for (const locale of supportedLocales) {
      for (const query of ['word', 'Word', 'pdf', '轉檔', 'docx']) {
        expect(searchTools(query, locale).map(tool => tool.slug), `${locale}/${query}`)
          .not.toContain(wordToPdfReservedSlug)
      }
    }
  })

  it('forbids every claim the record forbids', () => {
    const forbidden = parseForbiddenWording('## 10. 禁止用語')
    expect([...wordToPdfForbiddenWording].sort()).toEqual([...forbidden].sort())
    expect(forbidden.length).toBeGreaterThan(0)
  })
})

describe('the fidelity table is what the probes found', () => {
  /*
   * §4.3 prints one column per pipeline rather than one per browser, which is
   * only honest if the three browsers agree. So every row is checked against
   * all three, not against the one the table happened to be generated from.
   */
  it('repeats every fidelity verdict from every browser', () => {
    for (const row of parseFidelityRows()) {
      for (const [pipelineId, documented] of [['docx-preview', row.docxPreview], ['mammoth', row.mammoth]] as const) {
        for (const browser of browserNames) {
          const run = optionalRun(browser, pipelineId, row.fixture)
          expect(run, `${browser}/${pipelineId}/${row.fixture}`).toBeDefined()
          expect(fidelityVerdict(run!, row.aspect), `${browser}/${pipelineId}/${row.fixture}/${row.aspect}`).toBe(documented)
        }
      }
    }
  })
})

describe('the three browsers agreed, which is why the tables print one number', () => {
  it('ran the whole matrix in every browser', () => {
    expect(measurements.fixtures.length).toBe(42)
    for (const browser of browserNames) expect(measuredBrowser(browser).runs.length).toBe(110)
  })

  it('reached the same outcome, page count and text-item count everywhere', () => {
    for (const pipeline of measurements.pipelines) {
      for (const fixture of measurements.fixtures) {
        const runs = browserNames.map(browser => optionalRun(browser, pipeline.id, fixture.name)).filter(Boolean)
        if (runs.length === 0) continue
        expect(runs.length, `${pipeline.id}/${fixture.name}`).toBe(browserNames.length)
        const shape = runs.map(run => JSON.stringify({
          outcome: run!.outcome,
          pages: run!.probe?.renderedPages ?? null,
          pdfPages: run!.pdf?.writtenPages ?? null,
          textItems: run!.readBack?.textItems ?? null,
        }))
        expect(new Set(shape).size, `${pipeline.id}/${fixture.name}: ${shape.join(' vs ')}`).toBe(1)
      }
    }
  })
})

/**
 * The one word §4.3 prints for one aspect of one conversion.
 *
 * `kept` means everything the document declared is there; `lost` means none of
 * it is; `altered` means some of it is. `leaked` is reserved for the aspects
 * where showing the content is the failure — a deletion the author made, a
 * reviewer's comment — so it is never merged with `kept`.
 */
function fidelityVerdict(run: { probe?: { declaredText: { present: boolean }[], absentText: { present: boolean }[], tables: { rows: number, columns: number }[], images: { decoded: number }, headerText: { present: boolean }[], footerText: { present: boolean }[], footnoteText: { present: boolean }[], endnoteText: { present: boolean }[], commentText: { present: boolean }[], listMarkers: string[], equationText: { markers: { present: boolean }[] } | null, renderedPages: number } }, aspect: string) {
  const probe = run.probe
  if (!probe) return 'lost'

  const fraction = (entries: { present: boolean }[]) => entries.length === 0
    ? null
    : entries.filter(entry => entry.present).length / entries.length

  const word = (value: number | null) => value === null ? 'kept' : value === 1 ? 'kept' : value === 0 ? 'lost' : 'altered'

  switch (aspect) {
    case 'body-text': return word(fraction(probe.declaredText))
    case 'headers': return word(fraction(probe.headerText))
    case 'footers': return word(fraction(probe.footerText))
    case 'footnotes': return word(fraction(probe.footnoteText))
    case 'endnotes': return word(fraction(probe.endnoteText))
    case 'tables': return probe.tables.length === 0 ? 'lost' : 'kept'
    case 'images': return probe.images.decoded === 0 ? 'lost' : 'kept'
    case 'list-markers': return probe.listMarkers.length === 0 ? 'lost' : 'kept'
    case 'equations': return word(fraction(probe.equationText?.markers ?? []))
    case 'deleted-text': return probe.absentText.some(entry => entry.present) ? 'leaked' : 'kept'
    case 'comments': return probe.commentText.some(entry => entry.present) ? 'leaked' : 'kept'
    default: throw new Error(`Unknown fidelity aspect ${aspect}`)
  }
}

describe('the environment the numbers came from is recorded', () => {
  it('names every browser the matrix ran in', () => {
    for (const browser of browserNames) {
      expect(measuredBrowser(browser).environment.userAgent).toBeTruthy()
    }
  })

  it('says which browsers could answer the memory question', () => {
    const answering = browserNames.filter(browser => measuredBrowser(browser).environment.memoryApi === 'available')
    expect(sectionBody('## 5. 效能、記憶體與主執行緒')).toContain(answering.join('、'))
  })
})
