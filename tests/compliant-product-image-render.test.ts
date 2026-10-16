import { describe, expect, it } from 'vitest'
import { imageInputLimits } from '@/features/images/limits'
import { describeSizeIssue, encodableFormats, formatMimeTypes, type OutputBounds } from '@/features/tools/compliant-product-image/domain/render'
import { planPlacement } from '@/features/tools/compliant-product-image/domain/placement'

/** The device budget the workbench's layout step hands in; no channel narrows it any more (ADR-0022). */
const bounds: OutputBounds = {
  minWidth: 1,
  maxWidth: imageInputLimits.maxSide,
  minHeight: 1,
  maxHeight: imageInputLimits.maxSide,
  maxPixels: imageInputLimits.maxPixels,
}

describe('describing why one size cannot be produced', () => {
  it('accepts any whole-pixel canvas inside the device budget, whatever its ratio', () => {
    expect(describeSizeIssue(bounds, 1000, 1000)).toBeUndefined()
    expect(describeSizeIssue(bounds, 900, 1600)).toBeUndefined()
    expect(describeSizeIssue(bounds, 3000, 400)).toBeUndefined()
  })

  it('refuses a side that is not a whole number of at least one pixel', () => {
    expect(describeSizeIssue(bounds, 0, 1000)).toBe('too-small')
    expect(describeSizeIssue(bounds, 1000.5, 1000)).toBe('too-small')
  })

  it('refuses a canvas the device cannot decode', () => {
    expect(describeSizeIssue(bounds, imageInputLimits.maxSide + 1, 100)).toBe('too-large')
    expect(describeSizeIssue(bounds, 6000, 5000)).toBe('too-many-pixels')
  })
})

describe('output formats', () => {
  it('names a MIME type for every format a canvas can be asked to write', () => {
    expect(encodableFormats.map(format => formatMimeTypes[format])).toEqual(['image/jpeg', 'image/png', 'image/webp'])
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
