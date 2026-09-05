import { randomPickerLimits } from './reference'

/**
 * The wheel's geometry, kept apart from the draw on purpose: it can compute
 * where a slice sits and where the wheel has to stop for a given result, but it
 * has no way to choose one. Angles are degrees measured clockwise from the
 * pointer at the top, which is where the wheel is read.
 */

/** Drawn in a unit circle so the component only has to pick a viewBox. */
export const wheelRadius = 100
const FULL_TURN = 360

export interface WheelSlice {
  index: number
  label: string
  startAngle: number
  endAngle: number
  centreAngle: number
  /** Pie-slice path around the origin, for an SVG whose viewBox is centred there. */
  path: string
}

export function wheelSliceAngle(count: number) {
  return FULL_TURN / count
}

export function wheelSliceCentre(index: number, count: number) {
  return (index + 0.5) * wheelSliceAngle(count)
}

/**
 * The rotation that brings the drawn slice under the pointer. The result is an
 * input here, never an output: `turns` only decides how long the wheel spins
 * before it lands on the slice it was always going to land on.
 */
export function wheelStopRotation(index: number, count: number, turns: number) {
  return turns * FULL_TURN - wheelSliceCentre(index, count)
}

export function wheelSlices(labels: readonly string[]): WheelSlice[] {
  const count = labels.length
  if (count < randomPickerLimits.wheelMinEntries) return []

  return labels.map((label, index) => {
    const startAngle = index * wheelSliceAngle(count)
    const endAngle = startAngle + wheelSliceAngle(count)

    return {
      index,
      label,
      startAngle,
      endAngle,
      centreAngle: wheelSliceCentre(index, count),
      path: slicePath(startAngle, endAngle),
    }
  })
}

/** Whether a list can be read as a wheel at all, rather than only as text. */
export function canPresentWheel(entryCount: number, drawCount: number) {
  return drawCount === 1
    && entryCount >= randomPickerLimits.wheelMinEntries
    && entryCount <= randomPickerLimits.wheelMaxEntries
}

export function wheelPoint(angle: number, radius = wheelRadius) {
  const radians = (angle * Math.PI) / 180

  return { x: round(radius * Math.sin(radians)), y: round(-radius * Math.cos(radians)) }
}

function slicePath(startAngle: number, endAngle: number) {
  const start = wheelPoint(startAngle)
  const end = wheelPoint(endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return `M 0 0 L ${start.x} ${start.y} A ${wheelRadius} ${wheelRadius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

/** Three decimals keep the path stable across engines without visible seams. */
function round(value: number) {
  return Math.round(value * 1000) / 1000
}
