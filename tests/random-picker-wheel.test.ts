import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  nextWheelRotation,
  wheelDividerWidth,
  wheelFills,
  wheelLabelStyle,
  wheelSliceAngle,
  wheelSliceCentre,
  wheelSlices,
  wheelStopRotation,
  wheelWonOffset,
} from '@/features/tools/random-picker/domain/wheel'

/** Every slice of a full turn, measured clockwise from the pointer at the top. */
function normalize(angle: number) {
  return ((angle % 360) + 360) % 360
}

const stylesheet = readFileSync(resolve('app/assets/css/main.css'), 'utf8')
const darkTheme = stylesheet.slice(stylesheet.indexOf('.dark {'), stylesheet.indexOf('}', stylesheet.indexOf('.dark {')))

/** Follows a custom property through `var()` to the colour it finally names. */
function tokenColour(name: string): string {
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(stylesheet)?.[1]?.trim()
  const alias = value && /^var\(--([\w-]+)\)$/.exec(value)?.[1]
  if (alias) return tokenColour(alias)
  if (!value?.startsWith('#')) throw new Error(`--${name} is not a colour: ${value}`)
  return value
}

function luminance(hex: string) {
  const digits = hex.length === 4 ? [...hex.slice(1)].map(digit => digit + digit) : hex.slice(1).match(/../g)!
  const [red, green, blue] = digits.map((pair) => {
    const channel = Number.parseInt(pair, 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

function contrast(first: string, second: string) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (light! + 0.05) / (dark! + 0.05)
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

  it('writes a short wheel at the landing size across the slice, then shrinks and lays a crowded one along the radius', () => {
    expect(wheelLabelStyle(6), '首頁示範的六個名字').toEqual({ fontSize: 15, maxCharacters: 4, upright: true })
    expect(wheelLabelStyle(12).upright, '名字多時直立標籤會互相重疊').toBe(false)
    expect(wheelLabelStyle(12).fontSize).toBeLessThan(wheelLabelStyle(6).fontSize)
    expect(wheelLabelStyle(20).fontSize).toBeLessThan(wheelLabelStyle(12).fontSize)
    expect(wheelLabelStyle(40).fontSize).toBeLessThan(wheelLabelStyle(20).fontSize)

    expect(wheelSlices(['A', 'B', 'C'])[0]!.labelTransform).toMatch(/rotate\((0|180)\)$/)
    expect(wheelSlices(Array.from({ length: 30 }, (_, index) => `n${index}`))[1]!.labelTransform)
      .toMatch(/rotate\((-90|90)\)$/)
  })

  it('lays every name out to read the right way up where the wheel stops', () => {
    for (const count of [2, 3, 5, 6, 7, 12, 13, 24, 25, 48]) {
      const labels = Array.from({ length: count }, (_, index) => `n${index}`)
      for (let won = 0; won < count; won += 1) {
        const slices = wheelSlices(labels, nextWheelRotation(720, won, count, 5))

        for (const slice of slices) {
          expect(slice.labelTilt, `${count} 片停在第 ${won} 片時，第 ${slice.index} 片的名字不得倒置`).toBeGreaterThanOrEqual(-90)
          expect(slice.labelTilt).toBeLessThan(90)
        }
        if (wheelLabelStyle(count).upright) expect(slices[won]!.labelTilt, '指針下的名字是水平的').toBeCloseTo(0, 6)
      }
    }
  })

  it('colours the slices in the landing order and thins the ink as they narrow', () => {
    expect(wheelSlices(['1', '2', '3', '4', '5', '6', '7']).map(slice => slice.fill))
      .toEqual(['paper', 'pink', 'sky', 'mint', 'coral', 'paper', 'pink'])
    expect(wheelDividerWidth(20)).toBeLessThan(wheelDividerWidth(6))
    expect(wheelDividerWidth(48)).toBeLessThan(wheelDividerWidth(20))
  })

  it('keeps every name at WCAG AA contrast on every slice colour, in both themes', () => {
    const ink = /\.picker-wheel \{ --wheel-ink: var\(--([\w-]+)\)/.exec(stylesheet)?.[1]
    expect(ink, '輪盤的墨色來自分類平塗色的墨色').toBe('fill-ink')

    for (const fill of wheelFills) {
      const token = new RegExp(`\\.picker-wheel__slice--${fill} \\{ fill: var\\(--([\\w-]+)\\); \\}`).exec(stylesheet)?.[1]
      expect(token, `${fill} 扇形要有自己的顏色`).toBeTruthy()
      expect(contrast(tokenColour(ink!), tokenColour(token!)), `${fill} 扇形上的名字`).toBeGreaterThanOrEqual(4.5)
      // The fills and their ink are the same in the dark theme, so the light ratio holds there too.
      expect(darkTheme).not.toContain(`--${token}:`)
    }
    expect(darkTheme).not.toContain('--fill-ink:')
  })

  it('pulls the drawn slice straight out along its own centre line', () => {
    for (const slice of wheelSlices(['A', 'B', 'C', 'D'])) {
      const radians = (slice.centreAngle * Math.PI) / 180
      expect(slice.wonOffset.x).toBeCloseTo(wheelWonOffset * Math.sin(radians), 3)
      expect(slice.wonOffset.y).toBeCloseTo(-wheelWonOffset * Math.cos(radians), 3)
    }
  })

  it('clips a long label but never touches the name it stands for', () => {
    const long = wheelSlices(['王小明王小明王小明王小明', 'B'])[0]!

    expect([...long.label]).toHaveLength(wheelLabelStyle(2).maxCharacters)
    expect(long.label.endsWith('…'), '截斷必須看得出來').toBe(true)
    expect(wheelSlices(['王小明', 'B'])[0]!.label, '放得下就不動它').toBe('王小明')

    const six = wheelSlices(['Alex', 'Christopher', '王小明', '歐陽小明明', 'E', 'F'])
    expect(six[0]!.label, '英文字母只佔約半個字寬').toBe('Alex')
    expect(six[1]!.label).toBe('Chris…')
    expect(six[2]!.label).toBe('王小明')
    expect(six[3]!.label).toBe('歐陽小…')
  })
})
