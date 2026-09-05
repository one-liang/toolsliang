import { describe, expect, it } from 'vitest'
import {
  nextWheelRotation,
  wheelLabelStyle,
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

  it('always turns forwards to the next stop, however many draws came before', () => {
    const first = nextWheelRotation(0, 1, 4, 5)
    const second = nextWheelRotation(first, 3, 4, 5)

    expect(first).toBeGreaterThan(0)
    expect(second, '第二次抽選不得把輪盤往回轉').toBeGreaterThan(first)
    expect(normalize(wheelSliceCentre(3, 4) + second)).toBeCloseTo(0, 6)
  })

  it('keeps labels upright while they have room, then shrinks and lays them along the radius', () => {
    expect(wheelLabelStyle(6)).toEqual({ fontSize: 8, maxCharacters: 10, upright: true })
    expect(wheelLabelStyle(20).upright, '擁擠時直立標籤會互相重疊').toBe(false)
    expect(wheelLabelStyle(40).fontSize).toBeLessThan(wheelLabelStyle(20).fontSize)

    const upright = wheelSlices(['A', 'B', 'C'])[1]!
    expect(upright.labelTransform).toContain(`rotate(${-upright.centreAngle})`)
    expect(wheelSlices(Array.from({ length: 30 }, (_, index) => `n${index}`))[1]!.labelTransform)
      .toContain('rotate(-90)')
  })

  it('clips a long label but never touches the name it stands for', () => {
    const long = wheelSlices(['王小明王小明王小明王小明', 'B'])[0]!

    expect([...long.label]).toHaveLength(wheelLabelStyle(2).maxCharacters)
    expect(long.label.endsWith('…'), '截斷必須看得出來').toBe(true)
    expect(wheelSlices(['王小明', 'B'])[0]!.label, '放得下就不動它').toBe('王小明')
  })
})
