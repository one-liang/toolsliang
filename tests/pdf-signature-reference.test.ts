import { describe, expect, it } from 'vitest'
import {
  pdfDisplayBox,
  pdfDisplayPointToUserSpace,
  pdfEngineCandidates,
  pdfEngineExclusionReasons,
  pdfEngineExclusions,
  pdfSignatureBudgets,
  pdfSignatureDecision,
  pdfSignatureDisclosures,
  pdfSignatureError,
  pdfSignatureFailureCodes,
  pdfSignatureGateKeys,
  pdfSignatureLimits,
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
  browserNames,
  measuredCandidate,
  measuredFixture,
  measuredRun,
  parseCandidates,
  parseDisclosures,
  parseExclusions,
  parseFailureCodes,
  parseFidelityRows,
  parseFixtures,
  parseForbiddenWording,
  parseGates,
  parseLimits,
  parseTimings,
  parseVerdicts,
  pdfEngineDecisionRecord as record,
  pdfEngineMeasurements as measurements,
  sectionBody,
  verdictOf,
} from './support/pdf-engine-decision-record'

function candidateById(id: string): PdfEngineCandidate {
  const candidate = pdfEngineCandidates.find(entry => entry.id === id)
  if (!candidate) throw new Error(`No candidate ${id}`)

  return candidate
}

/** Package downloads are allowed; nothing about a document ever may be sent. */
const allowedHosts = ['registry.npmjs.org', 'www.npmjs.com', 'github.com', 'developer.mozilla.org', 'www.iso.org', 'opensource.adobe.com']

describe('vocabulary matches the decision record', () => {
  it('publishes exactly the documented candidates', () => {
    expect(pdfEngineCandidates.map(candidate => candidate.id)).toEqual(parseCandidates().map(row => row.id))
  })

  it('describes each candidate the way the record does', () => {
    for (const row of parseCandidates()) {
      const candidate = candidateById(row.id)
      expect(candidate.package).toBe(row.package)
      expect(candidate.version).toBe(row.version)
      expect(candidate.licence).toBe(row.licence)
      expect(candidate.licenceVerified).toBe(row.licenceVerified)
      expect(candidate.licenceUrl).toBe(row.licenceUrl)
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

  it('takes its limits and budgets from the record', () => {
    const documented = new Map(parseLimits().map(row => [row.key, row.value]))
    expect(pdfSignatureLimits.maxPages).toBe(documented.get('maxPages'))
    expect(pdfSignatureLimits.maxBytes).toBe(documented.get('maxBytes'))
    expect(pdfSignatureBudgets.firstPagePreviewMs).toBe(documented.get('firstPagePreviewMs'))
    expect(pdfSignatureBudgets.exportMs).toBe(documented.get('exportMs'))
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

  it('prints the compatibility verdict each browser actually reached', () => {
    for (const row of parseVerdicts('### 4.1 預設開啟')) {
      for (const browser of browserNames) {
        expect(row.verdicts[browser]).toBe(verdictOf(measuredRun(browser, row.candidateId, row.fixture)))
      }
    }
  })

  it('prints the password verdicts each browser actually reached', () => {
    for (const row of parseVerdicts('### 4.2 密碼保護檔')) {
      for (const browser of browserNames) {
        expect(row.verdicts[browser]).toBe(verdictOf(measuredRun(browser, row.candidateId, row.fixture, 'with-password')))
      }
    }
  })

  it('covers every candidate and document in the compatibility matrix', () => {
    const rows = parseVerdicts('### 4.1 預設開啟')
    expect(rows).toHaveLength(pdfEngineCandidates.length * measurements.fixtures.length)
  })

  it('prints the timings that were measured', () => {
    for (const row of parseTimings()) {
      const run = measuredRun(row.browser, row.candidateId, row.fixture)
      expect(row.openMs).toBe(run.stages.openMs)
      expect(row.previewMs).toBe(run.stages.firstPagePreviewMs ?? null)
      expect(row.exportMs).toBe(run.stages.exportMs ?? null)
      expect(row.memoryMiB).toBe(run.memoryBytes ? Math.round(run.memoryBytes / 1048576) : null)
    }
  })

  it('prints the fidelity the verifier read back', () => {
    for (const row of parseFidelityRows()) {
      const run = measuredRun(row.browser, pdfSignatureSelection.writeEngineId, row.fixture, pdfSignatureSelection.exportVariant)
      expect(row.inkRatio).toBe(run.verify?.firstPage?.inkRatio)
      expect(row.seeThroughRatio).toBe(run.verify?.firstPage?.seeThroughRatio)
      expect(row.strayInkPixels).toBe(run.verify?.firstPage?.strayInkPixels)
      expect(row.changedPixelsOutsidePlacement).toBe(run.verify?.firstPage?.changedPixelsOutsidePlacement)
      expect(row.untouchedPageChangedPixels).toBe(run.verify?.untouchedPage?.changedPixels ?? 0)
    }
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
    expect(sectionBody('## 7. 密碼、不支援結構與損毀檔策略')).toContain('ignoreEncryption')
    expect(pdfSignatureSelection.writeEngineId).not.toBe('pdf-lib')
  })

  it('reads every export back before calling it a download', () => {
    expect(pdfSignatureSelection.verifyExportBeforeDownload).toBe(true)
    expect(pdfSignatureFailureCodes).toContain('export_unreadable')
  })

  it('meets the specification budgets on the reference document in every browser', () => {
    for (const browser of browserNames) {
      const preview = measuredRun(browser, pdfSignatureSelection.previewEngineId, 'reference-20-page')
      expect(preview.stages.firstPagePreviewMs).toBeLessThanOrEqual(pdfSignatureBudgets.firstPagePreviewMs)

      const write = measuredRun(browser, pdfSignatureSelection.writeEngineId, 'reference-20-page', pdfSignatureSelection.exportVariant)
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
    expect(sectionBody('## 7. 密碼、不支援結構與損毀檔策略')).toContain('truncated')
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
  })

  it('refuses a rotation the format does not define', () => {
    expect(() => pdfDisplayBox({ box: [0, 0, 100, 100], rotation: 45 })).toThrow()
  })

  it('was proved by reading a signed page back in every browser', () => {
    for (const browser of browserNames) {
      for (const fixture of ['reference-20-page', 'rotated-pages', 'offset-crop-box']) {
        const run = measuredRun(browser, pdfSignatureSelection.writeEngineId, fixture, pdfSignatureSelection.exportVariant)
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
    expect(Object.keys(pdfSignatureDisclosures)).toEqual(documented.map(row => row.key))
    for (const row of documented) {
      expect(pdfSignatureDisclosures[row.key]!['zh-tw']).toBe(row['zh-tw'])
      expect(pdfSignatureDisclosures[row.key]!.en).toBe(row.en)
    }
  })

  it('says in both locales that the result is not a certificate-based signature', () => {
    expect(pdfSignatureDisclosures['not-a-digital-signature']!['zh-tw']).toContain('憑證式數位簽章')
    expect(pdfSignatureDisclosures['not-a-digital-signature']!.en).toContain('certificate-based digital signature')
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
