import { describe, expect, it } from 'vitest'
import { imageInputLimits } from '@/features/images/limits'
import {
  compliantImagePresets,
  type CompliantImagePreset,
} from '@/features/tools/compliant-product-image/domain/reference'
import { findCompliantImagePreset } from '@/features/tools/compliant-product-image/domain/preset'
import {
  defaultOutputSide,
  describeSizeIssue,
  encodableFormats,
  resolveByteRange,
  resolveOccupancyGuides,
  resolveOutputBounds,
  resolveOutputFormats,
  resolveSafeAreaInsets,
  suggestOutputSize,
} from '@/features/tools/compliant-product-image/domain/render'
import { planPlacement } from '@/features/tools/compliant-product-image/domain/placement'

const today = '2026-09-08'

function presetById(id: string): CompliantImagePreset {
  const preset = findCompliantImagePreset(id)
  if (!preset) throw new Error(`No preset ${id}`)

  return preset
}

describe('output bounds', () => {
  it('locks the two momo dimensions the source states exactly', () => {
    const bounds = resolveOutputBounds(presetById('momo-store-main'), today)

    expect(bounds.exact).toEqual({ width: 1000, height: 1000 })
  })

  it('never lets a channel bound exceed the local decoding budget', () => {
    compliantImagePresets.forEach((preset) => {
      const bounds = resolveOutputBounds(preset, today)

      expect(bounds.maxWidth, preset.id).toBeLessThanOrEqual(imageInputLimits.maxSide)
      expect(bounds.maxHeight, preset.id).toBeLessThanOrEqual(imageInputLimits.maxSide)
      expect(bounds.maxPixels, preset.id).toBeLessThanOrEqual(imageInputLimits.maxPixels)
    })
  })

  it('keeps a rule that is not yet in force out of the bounds', () => {
    const preset = presetById('google-merchant-center-main')

    // Google's 500 x 500 minimum only binds from 2027-01-31.
    expect(resolveOutputBounds(preset, today).minWidth).toBe(1)
    expect(resolveOutputBounds({ ...preset, reviewedAt: '2027-02-01' }, '2027-02-01').minWidth).toBe(500)
  })

  it('never lets a recommendation narrow what an output is allowed to be', () => {
    // Amazon recommends 1,000 px per side but only requires a 500 px longest side.
    const bounds = resolveOutputBounds(presetById('amazon-main'), today)

    expect(bounds.minWidth).toBe(1)
    expect(bounds.minLongestSide).toBe(500)
    expect(bounds.maxLongestSide).toBe(10_000)
  })

  it('carries the ruten aspect ratio range from its source', () => {
    const bounds = resolveOutputBounds(presetById('ruten-main'), today)

    expect(bounds.minRatio).toBe(0.2)
    expect(bounds.maxRatio).toBe(5)
    expect(bounds.ratio).toBeUndefined()
  })
})

describe('describing why one size cannot be produced', () => {
  it('rejects any size other than the exact one a channel states', () => {
    const bounds = resolveOutputBounds(presetById('momo-store-main'), today)

    expect(describeSizeIssue(bounds, 1000, 1000)).toBeUndefined()
    expect(describeSizeIssue(bounds, 1200, 1000)).toBe('not-exact')
  })

  it('names the bound a size misses rather than failing silently', () => {
    const bounds = resolveOutputBounds(presetById('amazon-main'), today)

    expect(describeSizeIssue(bounds, 400, 400)).toBe('longest-side')
    expect(describeSizeIssue(bounds, 900, 900)).toBeUndefined()
    expect(describeSizeIssue(bounds, 9000, 9000)).toBe('too-large')
  })

  it('rejects an aspect ratio the channel does not allow', () => {
    const bounds = resolveOutputBounds(presetById('ruten-main'), today)

    expect(describeSizeIssue(bounds, 3000, 400)).toBe('ratio')
    expect(describeSizeIssue(bounds, 1200, 900)).toBeUndefined()
  })

  it('refuses a canvas the device cannot decode even when the channel allows it', () => {
    const bounds = resolveOutputBounds(presetById('google-merchant-center-main'), today)

    expect(describeSizeIssue(bounds, 6000, 5000)).toBe('too-many-pixels')
    expect(describeSizeIssue(bounds, 0, 1000)).toBe('too-small')
  })
})

describe('suggested output size', () => {
  it('produces a size every preset can accept', () => {
    compliantImagePresets.forEach((preset) => {
      const bounds = resolveOutputBounds(preset, today)
      const { width, height } = suggestOutputSize(preset, today)

      expect(describeSizeIssue(bounds, width, height), preset.id).toBeUndefined()
    })
  })

  it('follows the size a channel recommends rather than the bare minimum', () => {
    expect(suggestOutputSize(presetById('google-merchant-center-main'), today)).toEqual({ width: 1500, height: 1500 })
    expect(suggestOutputSize(presetById('amazon-main'), today)).toEqual({ width: 1000, height: 1000 })
  })

  it('uses the exact size when the channel states one', () => {
    expect(suggestOutputSize(presetById('momo-store-ad'), today)).toEqual({ width: 1000, height: 1000 })
  })

  it('falls back to the tool default when the channel publishes no dimension', () => {
    expect(suggestOutputSize(presetById('ruten-main'), today))
      .toEqual({ width: defaultOutputSide, height: defaultOutputSide })
  })
})

describe('output formats', () => {
  it('offers only the intersection of the channel list and what this browser encodes', () => {
    expect(resolveOutputFormats(presetById('ruten-main'), today, encodableFormats)).toEqual(['jpeg', 'png'])
    expect(resolveOutputFormats(presetById('ruten-main'), today, ['webp', 'png'])).toEqual(['png'])
  })

  it('offers every encodable format when the source publishes no format rule', () => {
    // momo's coverage gap is exactly `format-set`.
    expect(resolveOutputFormats(presetById('momo-store-main'), today, encodableFormats))
      .toEqual([...encodableFormats])
  })

  it('drops a channel format this tool cannot encode', () => {
    const formats = resolveOutputFormats(presetById('amazon-main'), today, encodableFormats)

    expect(formats).toContain('jpeg')
    expect(formats).not.toContain('tiff')
    expect(formats).not.toContain('gif')
  })
})

describe('capacity, occupancy and safe area', () => {
  it('carries the byte range a channel requires', () => {
    expect(resolveByteRange(presetById('momo-store-main'), today)).toEqual({ min: 50_000, max: 1_000_000 })
    expect(resolveByteRange(presetById('ruten-main'), today)).toEqual({ max: 5_000_000 })
  })

  it('has no byte range where the source states none', () => {
    expect(resolveByteRange(presetById('amazon-main'), today)).toEqual({})
  })

  it('exposes the occupancy ratio as guidance, with the authority that stated it', () => {
    expect(resolveOccupancyGuides(presetById('momo-store-main'), today))
      .toEqual([{ ruleId: 'product-occupancy', ratio: 0.8, authority: 'requirement' }])
    expect(resolveOccupancyGuides(presetById('amazon-main'), today))
      .toEqual([{ ruleId: 'product-occupancy', ratio: 0.85, authority: 'recommendation' }])
  })

  it('has no safe area inset, because no reviewed channel publishes one', () => {
    compliantImagePresets.forEach((preset) => {
      expect(resolveSafeAreaInsets(preset, today), preset.id).toEqual([])
    })
  })
})

describe('placing one source image on the output canvas', () => {
  const source = { sourceWidth: 2000, sourceHeight: 1000, targetWidth: 1000, targetHeight: 1000 }

  it('covers the whole canvas and crops the overflow', () => {
    expect(planPlacement({ ...source, fit: 'cover', zoom: 100, offsetX: 0, offsetY: 0 }))
      .toEqual({ x: -500, y: 0, width: 2000, height: 1000, coverage: 1 })
  })

  it('fits the whole image inside the canvas and leaves the rest to the background', () => {
    expect(planPlacement({ ...source, fit: 'contain', zoom: 100, offsetX: 0, offsetY: 0 }))
      .toEqual({ x: 0, y: 250, width: 1000, height: 500, coverage: 0.5 })
  })

  it('scales around the centre of the canvas', () => {
    expect(planPlacement({ ...source, fit: 'contain', zoom: 50, offsetX: 0, offsetY: 0 }))
      .toEqual({ x: 250, y: 375, width: 500, height: 250, coverage: 0.125 })
  })

  it('moves the image by a share of the canvas and stops counting what falls outside', () => {
    expect(planPlacement({ ...source, fit: 'contain', zoom: 100, offsetX: 50, offsetY: 0 }))
      .toEqual({ x: 500, y: 250, width: 1000, height: 500, coverage: 0.25 })
    expect(planPlacement({ ...source, fit: 'contain', zoom: 100, offsetX: 100, offsetY: 0 }).coverage)
      .toBe(0)
  })

  it('never asks a canvas to draw a zero-pixel image', () => {
    const placement = planPlacement({
      sourceWidth: 4000,
      sourceHeight: 3000,
      targetWidth: 10,
      targetHeight: 10,
      fit: 'contain',
      zoom: 10,
      offsetX: 0,
      offsetY: 0,
    })

    expect(placement.width).toBeGreaterThanOrEqual(1)
    expect(placement.height).toBeGreaterThanOrEqual(1)
  })
})
