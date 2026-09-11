import { describe, expect, it } from 'vitest'
import {
  clampNormalizedRect,
  estimatePdfWorkingSetBytes,
  pdfDisplayBox,
  pdfDisplayPointToUserSpace,
  pdfEngineCandidates,
  pdfEngineExclusionReasons,
  pdfEngineExclusions,
  pdfEngineRoles,
  pdfSignatureBudgets,
  pdfSignatureDecision,
  pdfSignatureDisclosureKeys,
  pdfSignatureDisclosures,
  pdfSignatureError,
  pdfSignatureExportMode,
  pdfSignatureFailureCodes,
  pdfSignatureGateKeys,
  pdfSignatureImage,
  pdfSignatureLimits,
  pdfSignatureMemoryModel,
  pdfSignatureParserPolicy,
  pdfSignaturePermittedLicences,
  pdfSignaturePlacement,
  pdfSignatureReferenceVersion,
  pdfSignatureSelection,
  pdfSignatureStages,
  pdfSignatureStructures,
  pdfUserSpaceToDisplayPoint,
  redistributableEngines,
  type PdfEngineCandidate,
  type PdfPageGeometry,
} from '@/features/tools/pdf-signature/domain/reference'
import {
  clampNormalizedRect as harnessClamp,
  displayBox as harnessDisplayBox,
  displayPointToUserSpace as harnessToUserSpace,
  signaturePlacement as harnessPlacement,
  userSpaceToDisplayPoint as harnessToDisplayPoint,
} from '../scripts/pdf-engine/placement.mjs'
import {
  browserNames,
  measuredBrowser,
  measuredCandidate,
  measuredFixture,
  measuredRun,
  parseCandidates,
  parseDisclosures,
  parseExclusions,
  parseExportModeRows,
  parseFailureCodes,
  parseFidelityRows,
  parseFixtures,
  parseForbiddenWording,
  parseGates,
  parseLimits,
  parseOutsideMarginPt,
  parseTimings,
  parseVerdicts,
  pdfEngineDecisionRecord as record,
  pdfEngineMeasurements as measurements,
  sectionBody,
  sortRoles,
  verdictOf,
} from './support/pdf-engine-decision-record'

function candidateById(id: string): PdfEngineCandidate {
  const candidate = pdfEngineCandidates.find(entry => entry.id === id)
  if (!candidate) throw new Error(`No candidate ${id}`)

  return candidate
}

function everyRun() {
  return browserNames.flatMap(browser => measuredBrowser(browser).runs.map(run => ({ browser, run })))
}

/** Package downloads and specifications; nothing about a document ever may be sent. */
const allowedHosts = [
  'registry.npmjs.org',
  'www.npmjs.com',
  'github.com',
  'developer.mozilla.org',
  'www.iso.org',
  'opensource.adobe.com',
]

describe('vocabulary matches the decision record', () => {
  it('publishes exactly the documented candidates', () => {
    expect(pdfEngineCandidates.map(candidate => candidate.id)).toEqual(parseCandidates().map(row => row.id))
  })

  it('describes each candidate the way the record and the measurements do', () => {
    for (const row of parseCandidates()) {
      const candidate = candidateById(row.id)
      expect(candidate.package).toBe(row.package)
      expect(candidate.version).toBe(row.version)
      expect(candidate.licence).toBe(row.licence)
      expect(candidate.licenceVerified).toBe(row.licenceVerified)
      expect(candidate.licenceUrl).toBe(row.licenceUrl)
      /* Roles are stated in three places; the order they are listed in may differ. */
      expect(sortRoles(candidate.roles)).toEqual(sortRoles(row.roles))
      expect(sortRoles(candidate.roles)).toEqual(sortRoles(measuredCandidate(row.id).roles))
      for (const role of candidate.roles) expect(pdfEngineRoles).toContain(role)
    }
  })

  it('publishes exactly the documented exclusions and reasons', () => {
    const documented = parseExclusions()
    expect(pdfEngineExclusions.map(entry => entry.id)).toEqual(documented.map(row => row.id))
    for (const row of documented) {
      const exclusion = pdfEngineExclusions.find(entry => entry.id === row.id)
      expect(exclusion?.reason).toBe(row.reason)
      expect(pdfEngineExclusionReasons).toContain(row.reason)
    }
  })

  it('publishes exactly the documented failure codes, recoverability and actions', () => {
    const documented = parseFailureCodes()
    expect([...pdfSignatureFailureCodes]).toEqual(documented.map(row => row.code))
    for (const row of documented) {
      const error = pdfSignatureError(row.code as (typeof pdfSignatureFailureCodes)[number])
      expect(error.code).toBe(row.code)
      expect(error.recoverable).toBe(row.recoverable)
      expect(error.suggestedAction).toBe(row.suggestedAction)
    }
  })

  it('publishes exactly the documented gates', () => {
    expect([...pdfSignatureGateKeys]).toEqual(parseGates().map(row => row.key))
    for (const row of parseGates()) {
      expect(pdfSignatureDecision.gateVerdicts[row.key as (typeof pdfSignatureGateKeys)[number]]).toBe(row.verdict)
    }
  })

  it('lists exactly the gates that failed as blocking', () => {
    const failed = parseGates().filter(row => row.verdict === 'fail').map(row => row.key)
    expect([...pdfSignatureDecision.blockingGates]).toEqual(failed)
    expect(pdfSignatureDecision.status === 'go').toBe(failed.length === 0)
  })

  it('takes its limits, budgets and memory model from the record', () => {
    const documented = new Map(parseLimits().map(row => [row.key, row.value]))
    expect(pdfSignatureLimits.maxPages).toBe(documented.get('maxPages'))
    expect(pdfSignatureLimits.maxBytes).toBe(documented.get('maxBytes'))
    expect(pdfSignatureLimits.previewScale).toBe(documented.get('previewScale'))
    expect(pdfSignatureBudgets.firstPagePreviewMs).toBe(documented.get('firstPagePreviewMs'))
    expect(pdfSignatureBudgets.exportMs).toBe(documented.get('exportMs'))
    expect(pdfSignatureMemoryModel.baseBytes).toBe(documented.get('baseBytes'))
    expect(pdfSignatureMemoryModel.bytesPerInputByte).toBe(documented.get('bytesPerInputByte'))
    expect(pdfSignatureImage.maxEdgePixels).toBe(documented.get('maxSignatureEdgePixels'))
  })

  it('previews at the zoom the matrix measured', () => {
    expect(pdfSignatureLimits.previewScale).toBe(measurements.previewScale)
  })

  it('names the structures and stages the record works in', () => {
    const structures = new Set(measurements.fixtures.map(fixture => fixture.structure))
    expect([...pdfSignatureStructures].sort()).toEqual([...structures].sort())
    /* §12.12 of the specification fixes the stage names; the record may not rename them. */
    expect([...pdfSignatureStages]).toEqual(['read', 'parse', 'preview', 'apply', 'write'])
    for (const stage of pdfSignatureStages) expect(record).toContain(`\`${stage}\``)
  })
})

describe('the record only states what the measurements show', () => {
  it('names the documents the harness actually built', () => {
    const documented = parseFixtures()
    expect(documented.map(row => row.name)).toEqual(measurements.fixtures.map(fixture => fixture.name))
    for (const row of documented) {
      const fixture = measuredFixture(row.name)
      expect(row.structure).toBe(fixture.structure)
      expect(row.expectation).toBe(fixture.expectation)
      expect(row.encrypted).toBe(fixture.encrypted)
      expect(row.pages).toBe(fixture.pages)
      expect(row.byteLength).toBe(fixture.byteLength)
      expect(row.sha256).toBe(fixture.sha256)
    }
  })

  it('pins each candidate to the version and digest that were measured', () => {
    for (const candidate of pdfEngineCandidates) {
      const measured = measuredCandidate(candidate.id)
      expect(measured.version).toBe(candidate.version)
      expect(measured.licence).toBe(candidate.licence)
      expect(measured.licenceVerified).toBe(candidate.licenceVerified)
      expect(measured.integrity).toMatch(/^sha512-/)
      expect(measured.assets.length).toBeGreaterThan(0)
      for (const asset of measured.assets) expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('covers every candidate and document in the compatibility matrix', () => {
    expect(parseVerdicts('### 4.1 預設開啟'))
      .toHaveLength(pdfEngineCandidates.length * measurements.fixtures.length)
  })

  it('prints the compatibility verdict each browser actually reached', () => {
    for (const row of parseVerdicts('### 4.1 預設開啟')) {
      for (const browser of browserNames) {
        expect(row.verdicts[browser]).toBe(verdictOf(measuredRun(browser, row.candidateId, row.fixture)))
      }
    }
  })

  it('prints the protected-document verdicts each browser actually reached', () => {
    const rows = parseVerdicts('### 4.2 密碼與權限保護檔')
    const guarded = measurements.fixtures.filter(fixture =>
      fixture.expectation === 'password' || fixture.name === 'owner-password-restricted')
    expect(rows).toHaveLength(pdfEngineCandidates.length * guarded.length)
    for (const row of rows) {
      for (const browser of browserNames) {
        expect(row.verdicts[browser]).toBe(verdictOf(measuredRun(browser, row.candidateId, row.fixture, 'with-password')))
      }
    }
  })

  it('prints the timings that were measured', () => {
    const rows = parseTimings()
    expect(rows).toHaveLength(pdfEngineCandidates.length * 2 * browserNames.length)
    for (const row of rows) {
      const run = measuredRun(row.browser, row.candidateId, row.fixture)
      expect(row.openMs).toBe(run.stages.openMs)
      expect(row.previewMs).toBe(run.stages.firstPagePreviewMs ?? null)
      expect(row.exportMs).toBe(run.stages.exportMs ?? null)
      expect(row.memoryMiB).toBe(run.memoryBytes ? Math.round(run.memoryBytes / 1048576) : null)
    }
  })

  it('prints the fidelity the verifier read back, for the export mode each document takes', () => {
    const rows = parseFidelityRows()
    const signable = measurements.fixtures.filter(fixture =>
      fixture.expectation === 'open' || fixture.expectation === 'password')
    expect(rows).toHaveLength(signable.length * browserNames.length)
    for (const row of rows) {
      const fixture = measuredFixture(row.fixture)
      expect(row.exportMode).toBe(pdfSignatureExportMode(fixture))
      const run = measuredRun(row.browser, pdfSignatureSelection.writeEngineId, row.fixture,
        fixture.encrypted
          ? pdfSignatureSelection.exportVariants.encrypted
          : pdfSignatureSelection.exportVariants.unencrypted)
      expect(row.inkRatio).toBe(run.verify?.firstPage?.inkRatio)
      expect(row.seeThroughRatio).toBe(run.verify?.firstPage?.seeThroughRatio)
      expect(row.strayInkPixels).toBe(run.verify?.firstPage?.strayInkPixels)
      expect(row.changedPixelsOutsidePlacement).toBe(run.verify?.firstPage?.changedPixelsOutsidePlacement)
      expect(row.untouchedPageChangedPixels).toBe(run.verify?.untouchedPage?.changedPixels ?? 0)
    }
  })

  it('states the margin the outside count actually used', () => {
    const margins = new Set(everyRun()
      .map(({ run }) => run.verify?.firstPage?.placementMarginPt)
      .filter(value => value !== undefined))
    expect(margins.size).toBe(1)
    /* A tolerance that is not written down is a tolerance nobody can check. */
    expect(parseOutsideMarginPt()).toBe([...margins][0])
  })

  it('prints what the two export modes actually cost', () => {
    const rows = parseExportModeRows()
    expect(rows).toHaveLength(2 * browserNames.length)
    for (const row of rows) {
      expect(row.fullRewriteMs)
        .toBe(measuredRun(row.browser, pdfSignatureSelection.writeEngineId, row.fixture).stages.exportMs)
      expect(row.incrementalMs)
        .toBe(measuredRun(row.browser, pdfSignatureSelection.writeEngineId, row.fixture, 'incremental').stages.exportMs)
    }
  })

  it('states the measured range the memory coefficient was taken from', () => {
    const selected = [pdfSignatureSelection.previewEngineId, pdfSignatureSelection.writeEngineId]
    const ratios = measuredBrowser('chromium').runs
      .filter(run => run.memoryBytes && selected.includes(run.candidateId))
      .map(run => (run.memoryBytes! - pdfSignatureMemoryModel.baseBytes)
        / Math.max(measuredFixture(run.fixture).byteLength, 1))
      .filter(ratio => ratio > 0)
    const documented = /這個值落在 ([\d.]+) 至 ([\d.]+) 之間/.exec(sectionBody('### 9.2 上限與預算'))
    expect(documented).not.toBeNull()
    /*
     * The stated range has to contain the measured one — rounding may widen it,
     * never narrow it — and stay close enough to still describe the data.
     */
    const low = Number(documented![1])
    const high = Number(documented![2])
    expect(low).toBeLessThanOrEqual(Math.min(...ratios))
    expect(low).toBeGreaterThan(Math.min(...ratios) - 0.05)
    expect(high).toBeGreaterThanOrEqual(Math.max(...ratios))
    expect(high).toBeLessThan(Math.max(...ratios) + 0.05)
    /* And the coefficient the tool uses has to bound the whole range. */
    expect(pdfSignatureMemoryModel.bytesPerInputByte).toBeGreaterThanOrEqual(Math.max(...ratios))
  })
})

describe('the selection is one the project may ship', () => {
  it('only selects engines whose licence this project may redistribute', () => {
    for (const id of [pdfSignatureSelection.previewEngineId, pdfSignatureSelection.writeEngineId]) {
      const candidate = candidateById(id)
      expect(candidate.licenceVerified).toBe(true)
      expect(pdfSignaturePermittedLicences).toContain(candidate.licence)
      expect(redistributableEngines.map(entry => entry.id)).toContain(id)
    }
  })

  it('keeps a candidate whose declared licence does not cover what it ships out of the selection', () => {
    const unverified = pdfEngineCandidates.filter(candidate => !candidate.licenceVerified)
    expect(unverified.length).toBeGreaterThan(0)
    for (const candidate of unverified) {
      expect(redistributableEngines.map(entry => entry.id)).not.toContain(candidate.id)
      expect([pdfSignatureSelection.previewEngineId, pdfSignatureSelection.writeEngineId]).not.toContain(candidate.id)
    }
  })

  it('selects engines that refuse an encrypted document without the password and open it with one', () => {
    for (const browser of browserNames) {
      for (const fixture of ['encrypted-rc4-128', 'encrypted-aes-128']) {
        for (const id of [pdfSignatureSelection.previewEngineId, pdfSignatureSelection.writeEngineId]) {
          expect(verdictOf(measuredRun(browser, id, fixture))).not.toBe('opened')
          expect(verdictOf(measuredRun(browser, id, fixture, 'with-password'))).toBe('opened')
        }
      }
    }
  })

  it('never reaches for the option that silently drops the signature', () => {
    /*
     * `pdf-lib`'s documented way past an encrypted document exports a file that
     * opens and carries no signature at all. It is measured so the record can
     * forbid it by name, and it is why the fork was chosen over the upstream.
     */
    for (const browser of browserNames) {
      for (const fixture of ['encrypted-rc4-128', 'encrypted-aes-128']) {
        const run = measuredRun(browser, 'pdf-lib', fixture, 'ignore-encryption')
        expect(run.outcome).toBe('ok')
        expect(run.verify?.firstPage?.inkRatio).toBe(0)
        expect(run.verify?.firstPage?.changedPixelsOutsidePlacement).toBe(0)
      }
    }
    expect(sectionBody('### 7.4 損毀檔')).toContain('ignoreEncryption')
    expect(pdfSignatureSelection.writeEngineId).not.toBe('pdf-lib')
  })

  it('appends to an unencrypted document and rewrites an encrypted one', () => {
    expect(pdfSignatureExportMode({ encrypted: false })).toBe('incremental-update')
    expect(pdfSignatureExportMode({ encrypted: true })).toBe('full-rewrite')
    expect(pdfSignatureSelection.encryptedExportIsDecrypted).toBe(true)
  })

  it('does not append to an encrypted document, because the page stops showing through the signature', () => {
    /*
     * An incremental update leaves `/Encrypt` behind an older trailer and writes
     * the appended objects in the clear. The signature still lands, but far less
     * of the page shows through it than on the same document rewritten in full:
     * the transparency does not survive the mismatch.
     */
    for (const browser of browserNames) {
      for (const fixture of measurements.fixtures.filter(entry => entry.encrypted).map(entry => entry.name)) {
        const appended = measuredRun(browser, pdfSignatureSelection.writeEngineId, fixture, 'incremental')
        const rewritten = measuredRun(browser, pdfSignatureSelection.writeEngineId, fixture, 'with-password')
        expect(appended.verify?.firstPage?.seeThroughRatio)
          .toBeLessThan(rewritten.verify!.firstPage!.seeThroughRatio - 0.2)
        /* And the damage reaches past the signature: the page itself changes. */
        expect(appended.verify?.firstPage?.changedPixelsOutsidePlacement).toBeGreaterThan(0)
        expect(rewritten.verify?.firstPage?.changedPixelsOutsidePlacement).toBe(0)
      }
    }
    expect(pdfSignatureSelection.exportModes.encrypted).toBe('full-rewrite')
  })

  it('reads every export back before calling it a download', () => {
    expect(pdfSignatureSelection.verifyExportBeforeDownload).toBe(true)
    expect(pdfSignatureFailureCodes).toContain('export_unreadable')
  })

  it('meets the specification budgets on the reference document in every browser', () => {
    for (const browser of browserNames) {
      const preview = measuredRun(browser, pdfSignatureSelection.previewEngineId, 'reference-20-page')
      expect(preview.stages.firstPagePreviewMs).toBeLessThanOrEqual(pdfSignatureBudgets.firstPagePreviewMs)

      const write = measuredRun(browser, pdfSignatureSelection.writeEngineId, 'reference-20-page',
        pdfSignatureSelection.exportVariants.unencrypted)
      const total = (write.stages.openMs ?? 0) + (write.stages.applyMs ?? 0) + (write.stages.exportMs ?? 0)
      expect(total).toBeLessThanOrEqual(pdfSignatureBudgets.exportMs)
    }
  })

  it('places the safety caps below what a browser was measured to survive', () => {
    expect(pdfSignatureLimits.maxPages).toBeLessThanOrEqual(measuredFixture('page-cap-120').pages)
    expect(pdfSignatureLimits.maxBytes).toBeLessThanOrEqual(measuredFixture('large-56-page').byteLength)
    for (const browser of browserNames) {
      expect(verdictOf(measuredRun(browser, pdfSignatureSelection.writeEngineId, 'page-cap-120'))).toBe('opened')
      expect(verdictOf(measuredRun(browser, pdfSignatureSelection.writeEngineId, 'large-56-page'))).toBe('opened')
    }
  })

  it('estimates a working set no smaller than the one that was measured', () => {
    /* The model describes the two engines the tool ships, not the ones it declined. */
    const selected = [pdfSignatureSelection.previewEngineId, pdfSignatureSelection.writeEngineId]
    const sampled = measuredBrowser('chromium').runs
      .filter(run => run.memoryBytes && selected.includes(run.candidateId))
    expect(sampled.length).toBeGreaterThan(0)
    for (const run of sampled) {
      expect(run.memoryBytes!, `${run.candidateId}/${run.fixture}`)
        .toBeLessThanOrEqual(estimatePdfWorkingSetBytes(measuredFixture(run.fixture).byteLength))
    }
    /* Both engines hold the document while a page is being signed. */
    expect(pdfSignatureMemoryModel.engines).toBe(2)
    expect(estimatePdfWorkingSetBytes(0)).toBe(pdfSignatureMemoryModel.baseBytes)
  })

  it('rejects a damaged document rather than exporting one nothing can open', () => {
    /*
     * The selected writer accepts the truncated document and produces bytes the
     * verifier cannot read. That is the reason the export is read back, and the
     * record has to keep saying so.
     */
    for (const browser of browserNames) {
      const run = measuredRun(browser, pdfSignatureSelection.writeEngineId, 'truncated')
      expect(run.verify?.failed).toBeDefined()
    }
    expect(sectionBody('### 7.4 損毀檔')).toContain('truncated')
  })
})

describe('nothing in a document may make anything happen', () => {
  it('declares a parser that runs nothing and fetches nothing', () => {
    for (const allowed of Object.values(pdfSignatureParserPolicy)) expect(allowed).toBe(false)
  })

  it('measured a document that asks for all of it', () => {
    const fixture = measuredFixture('active-content')
    expect(fixture.structure).toBe('active-content')
    for (const browser of browserNames) {
      for (const candidate of pdfEngineCandidates) {
        expect(verdictOf(measuredRun(browser, candidate.id, fixture.name))).toBe('opened')
      }
    }
  })

  it('never let a document run its own script, and says so on every single run', () => {
    for (const { browser, run } of everyRun()) {
      /* `toBe(false)` rather than `not.toBe(true)`: a run that stopped reporting
       * the flag at all would otherwise pass without evidence. */
      expect(run.activeContentRan, `${browser}/${run.candidateId}/${run.fixture}`).toBe(false)
    }
  })

  it('never let a document or a library reach for anything it was not given', () => {
    for (const { browser, run } of everyRun()) {
      expect(run.unexpectedRequests, `${browser}/${run.candidateId}/${run.fixture}`).toEqual([])
    }
  })

  it('watched every request the browser made, not only the ones the harness served', () => {
    /*
     * The probe the active-content document points at is on a different origin
     * from the harness, so a check built from the harness server's own access log
     * could never have seen it. The per-run list therefore comes from the
     * browser's request events, and `unservedMismatch` is the cross-check that
     * those events miss nothing the server actually served.
     */
    const probe = new URL(measurements.activeContentProbe)
    const origins = new Set(everyRun()
      .flatMap(({ run }) => [...(run.unexpectedRequests ?? []), ...(run.unservedMismatch ?? [])])
      .map(url => new URL(url).origin))
    for (const origin of origins) expect(origin).not.toBe(probe.origin)

    for (const { browser, run } of everyRun()) {
      /*
       * The only thing the events do not see is the favicon, which the browser
       * fetches outside the page's request pipeline. Anything else here would
       * mean the capture has a blind spot, and the claim above would not hold.
       */
      const unseen = (run.unservedMismatch ?? []).map(url => new URL(url).pathname)
      expect(unseen, `${browser}/${run.candidateId}/${run.fixture}`)
        .toEqual(unseen.length === 0 ? [] : ['/favicon.ico'])
    }
  })

  it('reports the candidate roles the registry declares', () => {
    for (const { run } of everyRun()) {
      expect(sortRoles(run.roles ?? [])).toEqual(sortRoles(measuredCandidate(run.candidateId).roles))
    }
  })
})

describe('a document may withhold permission to change it', () => {
  const restricted = 'owner-password-restricted'

  it('reads the permission bits with the preview engine', () => {
    for (const browser of browserNames) {
      const run = measuredRun(browser, pdfSignatureSelection.previewEngineId, restricted)
      expect(run.outcome).toBe('ok')
      /* Printing is allowed; modifying the contents and the annotations is not. */
      expect(run.permissions).toContain(4)
      expect(run.permissions).not.toContain(8)
      expect(run.permissions).not.toContain(32)
    }
  })

  it('opens without asking the user for anything, because its user password is empty', () => {
    for (const browser of browserNames) {
      expect(verdictOf(measuredRun(browser, pdfSignatureSelection.previewEngineId, restricted))).toBe('opened')
    }
  })

  it('has a code of its own, so the refusal is not reported as a broken file', () => {
    expect(pdfSignatureFailureCodes).toContain('modification_not_permitted')
    expect(pdfSignatureError('modification_not_permitted').suggestedAction).toBe('change-input')
    expect(sectionBody('### 7.2 權限')).toContain(restricted)
  })
})

describe('the signature image contract', () => {
  it('embeds one form only, so no font is ever written into a document', () => {
    expect(pdfSignatureImage.format).toBe('image/png')
    expect(pdfSignatureImage.alpha).toBe('required')
    expect(pdfSignatureImage.renderScale).toBeGreaterThanOrEqual(2)
    expect(pdfSignatureImage.maxEdgePixels).toBeGreaterThan(0)
    expect(sectionBody('### 6.5 簽名影像契約')).toContain('字型')
  })

  it('is read back with the page still visible through it', () => {
    for (const browser of browserNames) {
      const run = measuredRun(browser, pdfSignatureSelection.writeEngineId, 'reference-20-page',
        pdfSignatureSelection.exportVariants.unencrypted)
      expect(run.verify?.firstPage?.seeThroughRatio).toBeGreaterThan(0.5)
    }
  })
})

describe('the placement contract', () => {
  const portrait: PdfPageGeometry = { box: [0, 0, 595.28, 841.89], rotation: 0 }
  const rotated: PdfPageGeometry = { box: [0, 0, 595.28, 841.89], rotation: 90 }
  const offset: PdfPageGeometry = { box: [50, 60, 545, 762], rotation: 0 }
  const rect = { x: 0.1, y: 0.03, width: 0.3, height: 0.09 }

  it('swaps the display edges on a quarter-turned page', () => {
    expect(pdfDisplayBox(portrait)).toEqual({ width: 595.28, height: 841.89, rotation: 0 })
    expect(pdfDisplayBox(rotated)).toEqual({ width: 841.89, height: 595.28, rotation: 90 })
  })

  it('measures the display box from the visible box, not the media box', () => {
    expect(pdfDisplayBox(offset)).toEqual({ width: 495, height: 702, rotation: 0 })
  })

  it('round-trips every display point back to itself at every rotation', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const page: PdfPageGeometry = { box: [20, 30, 615, 822], rotation }
      const display = pdfDisplayBox(page)
      for (const point of [{ x: 0, y: 0 }, { x: 12.5, y: 400 }, { x: display.width, y: display.height }]) {
        const user = pdfDisplayPointToUserSpace(page, point)
        const back = pdfUserSpaceToDisplayPoint(page, user)
        expect(back.x).toBeCloseTo(point.x, 6)
        expect(back.y).toBeCloseTo(point.y, 6)
      }
    }
  })

  it('keeps the top-left of the display box at the top-left of the page', () => {
    /* An unrotated page's display origin is the top-left corner of its box. */
    expect(pdfDisplayPointToUserSpace(portrait, { x: 0, y: 0 })).toEqual({ x: 0, y: 841.89 })
    /* A quarter turn clockwise moves the box's bottom-left corner to the top-left. */
    expect(pdfDisplayPointToUserSpace(rotated, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('anchors the image at its own bottom-left corner and rotates with the page', () => {
    const placement = pdfSignaturePlacement(portrait, rect)
    expect(placement.rotation).toBe(0)
    expect(placement.width).toBeCloseTo(0.3 * 595.28, 6)
    expect(placement.height).toBeCloseTo(0.09 * 841.89, 6)
    expect(placement.anchor.x).toBeCloseTo(0.1 * 595.28, 6)
    expect(placement.anchor.y).toBeCloseTo(841.89 - (0.03 + 0.09) * 841.89, 6)
    expect(placement.display).toEqual({ width: 595.28, height: 841.89 })

    const turned = pdfSignaturePlacement(rotated, rect)
    expect(turned.rotation).toBe(90)
    expect(turned.anchor.x).toBeCloseTo((0.03 + 0.09) * 595.28, 6)
    expect(turned.anchor.y).toBeCloseTo(0.1 * 841.89, 6)
  })

  it('offsets the placement by the visible box origin', () => {
    const placement = pdfSignaturePlacement(offset, rect)
    expect(placement.anchor.x).toBeCloseTo(50 + 0.1 * 495, 6)
    expect(placement.anchor.y).toBeCloseTo(762 - (0.03 + 0.09) * 702, 6)
  })

  it('keeps the placement inside the visible box', () => {
    const placement = pdfSignaturePlacement(portrait, { x: 0.9, y: 0.95, width: 0.4, height: 0.2 })
    expect(placement.left + placement.width).toBeLessThanOrEqual(595.28 + 1e-9)
    expect(placement.top + placement.height).toBeLessThanOrEqual(841.89 + 1e-9)
    expect(placement.left).toBeGreaterThanOrEqual(0)
    expect(placement.top).toBeGreaterThanOrEqual(0)
    /* A rectangle bigger than the page is the only case where the size gives. */
    expect(clampNormalizedRect({ x: 0, y: 0, width: 2, height: 3 })).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('refuses a rotation the format does not define', () => {
    expect(() => pdfDisplayBox({ box: [0, 0, 100, 100], rotation: 45 })).toThrow()
  })

  it('agrees with the copy the harness measured, on every geometry it measured', () => {
    /*
     * The evidence in §6.3 belongs to the exported functions only if the two
     * implementations answer the same. They are separate because one is a
     * browser module the harness loads and the other is the typed domain module.
     */
    const rects = [rect, { x: 0.9, y: 0.95, width: 0.4, height: 0.2 }, { x: -1, y: 2, width: 3, height: 0.5 }]
    for (const rotation of [0, 90, 180, 270, -90, 450]) {
      for (const box of [[0, 0, 595.28, 841.89], [20, 30, 615, 822], [50, 60, 545, 762]] as const) {
        const page = { box, rotation }
        expect(harnessDisplayBox(page)).toEqual(pdfDisplayBox(page))
        for (const point of [{ x: 0, y: 0 }, { x: 33.3, y: 401.5 }]) {
          expect(harnessToUserSpace(page, point)).toEqual(pdfDisplayPointToUserSpace(page, point))
          expect(harnessToDisplayPoint(page, point)).toEqual(pdfUserSpaceToDisplayPoint(page, point))
        }
        for (const candidate of rects) {
          expect(harnessClamp(candidate)).toEqual(clampNormalizedRect(candidate))
          expect(harnessPlacement(page, candidate)).toEqual(pdfSignaturePlacement(page, candidate))
        }
      }
    }
  })

  it('was proved by reading a signed page back in every browser', () => {
    for (const browser of browserNames) {
      for (const fixture of ['reference-20-page', 'rotated-pages', 'offset-crop-box']) {
        const run = measuredRun(browser, pdfSignatureSelection.writeEngineId, fixture,
          pdfSignatureSelection.exportVariants.unencrypted)
        for (const page of [run.verify?.firstPage, run.verify?.lastPage]) {
          expect(page?.inkRatio).toBeGreaterThan(0.1)
          expect(page?.seeThroughRatio).toBeGreaterThan(0.5)
          expect(page?.strayInkPixels).toBe(0)
          expect(page?.changedPixelsOutsidePlacement).toBe(0)
          expect(page?.rotationPreserved).toBe(true)
          expect(page?.widthPreserved).toBe(true)
          expect(page?.heightPreserved).toBe(true)
        }
      }
    }
  })
})

describe('the boundary the record fixes', () => {
  it('states that the document never leaves the device', () => {
    const body = sectionBody('## 1. 範圍與方法')
    expect(body).toContain('不離開')
    expect(record).toContain('ADR-0001')
  })

  it('only ever points at sources a package download may reach', () => {
    for (const url of record.match(/https?:\/\/[^\s)<>|]+/g) ?? []) {
      expect(allowedHosts).toContain(new URL(url).hostname)
    }
  })

  it('keeps every measured document synthetic', () => {
    for (const fixture of measurements.fixtures) {
      expect(fixture.name).toMatch(/^[a-z0-9-]+$/)
      expect(fixture.note).not.toMatch(/[一-鿿]/)
    }
    expect(sectionBody('## 12. 驗證範圍與限制')).toContain('合成')
  })

  it('records no browser error that names a document', () => {
    for (const browser of measurements.browsers) {
      for (const message of browser.pageErrors) expect(message).not.toMatch(/\.pdf/i)
    }
  })
})

describe('the bilingual wording', () => {
  it('publishes exactly the documented copy in both locales', () => {
    const documented = parseDisclosures()
    expect([...pdfSignatureDisclosureKeys]).toEqual(documented.map(row => row.key))
    expect(Object.keys(pdfSignatureDisclosures)).toEqual(documented.map(row => row.key))
    for (const row of documented) {
      const key = row.key as (typeof pdfSignatureDisclosureKeys)[number]
      expect(pdfSignatureDisclosures[key]['zh-tw']).toBe(row['zh-tw'])
      expect(pdfSignatureDisclosures[key].en).toBe(row.en)
    }
  })

  it('says in both locales that the result is not a certificate-based signature', () => {
    expect(pdfSignatureDisclosures['not-a-digital-signature']['zh-tw']).toContain('憑證式數位簽章')
    expect(pdfSignatureDisclosures['not-a-digital-signature'].en).toContain('certificate-based digital signature')
  })

  it('tells the user that signing a protected document removes its password', () => {
    expect(pdfSignatureSelection.encryptedExportIsDecrypted).toBe(true)
    expect(pdfSignatureDisclosures['decrypted-export']['zh-tw']).toContain('密碼')
    expect(pdfSignatureDisclosures['decrypted-export'].en).toContain('password')
  })

  it('never claims legal effect or identity assurance', () => {
    const forbidden = parseForbiddenWording('### 10.2 禁止用語')
    expect(forbidden.length).toBeGreaterThan(0)
    const copy = Object.values(pdfSignatureDisclosures)
      .flatMap(entry => [entry['zh-tw'], entry.en])
      .join('\n')
    for (const wording of forbidden) expect(copy).not.toContain(wording)
  })

  it('names the version the wording and the selection belong to', () => {
    expect(pdfSignatureReferenceVersion).toBe(`pdf-signature-${measurements.measuredAt}`)
    expect(record).toContain(pdfSignatureReferenceVersion)
  })
})
