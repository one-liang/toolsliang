import { describe, expect, it } from 'vitest'
import {
  wheelSliceAngle,
  wheelSliceCentre,
  wheelSlices,
  wheelStopRotation,
} from '@/features/tools/random-picker/domain/wheel'

/** Every slice of a full turn, measured clockwise from the pointer at the top. */
function normalize(angle: number) {
  return ((angle % 360) + 360) % 360
}

describe('wheel geometry', () => {
  it('divides the wheel into equal slices', () => {
    expect(wheelSliceAngle(4)).toBe(90)
    expect(wheelSliceAngle(3)).toBeCloseTo(120)
    expect(wheelSlices(['A', 'B', 'C', 'D']).map(slice => slice.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(wheelSlices(['A', 'B', 'C', 'D']).map(slice => slice.startAngle)).toEqual([0, 90, 180, 270])
  })

  it('always stops with the drawn slice centred under the pointer', () => {
    for (const count of [2, 3, 7, 12, 48]) {
      for (let index = 0; index < count; index += 1) {
        const rotation = wheelStopRotation(index, count, 5)

        expect(normalize(wheelSliceCentre(index, count) + rotation), `${count} 片的第 ${index} 片`).toBeCloseTo(0, 6)
      }
    }
  })

  it('turns the full number of times asked for before it settles', () => {
    expect(wheelStopRotation(0, 4, 0), '不播動畫時停在同一個角度，只是沒有多轉').toBeCloseTo(-45)
    expect(wheelStopRotation(0, 4, 5) - wheelStopRotation(0, 4, 0)).toBeCloseTo(5 * 360)
  })

  it('does not depend on the entry text, so the animation cannot change the result', () => {
    expect(wheelStopRotation(2, 5, 3)).toBe(wheelStopRotation(2, 5, 3))
    expect(wheelSlices(['甲', '乙']).map(slice => slice.startAngle))
      .toEqual(wheelSlices(['A', 'B']).map(slice => slice.startAngle))
  })
})
