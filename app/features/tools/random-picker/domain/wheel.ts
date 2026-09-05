import { randomPickerLimits } from './reference'

/**
 * The wheel's geometry, kept apart from the draw on purpose: it can say where a
 * slice sits and where the wheel has to stop for a given result, but it has no
 * way to choose one. Angles are degrees measured clockwise from the pointer at
 * the top, which is where the wheel is read.
 */

export const wheelFullTurn = 360
/** Drawn in a unit circle so the component only has to place the viewBox. */
export const wheelRadius = 100
/** Leaves room for the stroke of the drawn slice, which sits outside the arc. */
const wheelBounds = 110
export const wheelViewBox = `${-wheelBounds} ${-wheelBounds} ${wheelBounds * 2} ${wheelBounds * 2}`
const labelRadius = 66

export interface WheelSlice {
  index: number
  label: string
  startAngle: number
  endAngle: number
  centreAngle: number
  /** Pie-slice path around the origin, for an SVG whose viewBox is centred there. */
  path: string
  /** Places and turns the slice's label; see `wheelLabelStyle` for why it turns. */
  labelTransform: string
}

/** How a label is drawn once the wheel gets crowded enough to change the rules. */
export interface WheelLabelStyle {
  fontSize: number
  /** Characters a label keeps before it is clipped; the list beside the wheel stays complete. */
  maxCharacters: number
  /** Upright reads best, but only while the labels have room not to collide. */
  upright: boolean
}

export function wheelSliceAngle(count: number) {
  return wheelFullTurn / count
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
  return turns * wheelFullTurn - wheelSliceCentre(index, count)
}

/** The next stop, always ahead of the current angle, so the wheel never snaps backwards. */
export function nextWheelRotation(currentRotation: number, index: number, count: number, turns: number) {
  return Math.ceil(currentRotation / wheelFullTurn) * wheelFullTurn + wheelStopRotation(index, count, turns)
}

/**
 * A short wheel keeps its labels upright, which is the easiest to read; a
 * crowded one shrinks them and lays them along the radius so they stop
 * colliding. The thresholds are about legibility at the rendered size, which is
 * why they live with the geometry rather than with the reviewed list ceilings.
 */
export function wheelLabelStyle(count: number): WheelLabelStyle {
  if (count > 24) return { fontSize: 4, maxCharacters: 4, upright: false }
  if (count > 12) return { fontSize: 6, maxCharacters: 6, upright: false }

  return { fontSize: 8, maxCharacters: 10, upright: true }
}

export function wheelSlices(labels: readonly string[]): WheelSlice[] {
  const count = labels.length
  if (count < randomPickerLimits.wheelMinEntries) return []

  const style = wheelLabelStyle(count)

  return labels.map((label, index) => {
    const startAngle = index * wheelSliceAngle(count)
    const endAngle = startAngle + wheelSliceAngle(count)
    const centreAngle = wheelSliceCentre(index, count)

    return {
      index,
      label: clipLabel(label, style.maxCharacters),
      startAngle,
      endAngle,
      centreAngle,
      path: slicePath(startAngle, endAngle),
      labelTransform: labelTransform(centreAngle, style.upright),
    }
  })
}

/** Whether a list can be read as a wheel at all, rather than only as text. */
export function canPresentWheel(entryCount: number, drawCount: number) {
  return drawCount === 1
    && entryCount >= randomPickerLimits.wheelMinEntries
    && entryCount <= randomPickerLimits.wheelMaxEntries
}

function labelTransform(centreAngle: number, upright: boolean) {
  return `rotate(${centreAngle}) translate(0 ${-labelRadius}) rotate(${upright ? -centreAngle : -90})`
}

function clipLabel(label: string, maxCharacters: number) {
  const characters = [...label]

  return characters.length > maxCharacters
    ? `${characters.slice(0, maxCharacters - 1).join('')}…`
    : label
}

function slicePath(startAngle: number, endAngle: number) {
  const start = wheelPoint(startAngle)
  const end = wheelPoint(endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return `M 0 0 L ${start.x} ${start.y} A ${wheelRadius} ${wheelRadius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function wheelPoint(angle: number) {
  const radians = (angle * Math.PI) / 180

  return { x: round(wheelRadius * Math.sin(radians)), y: round(-wheelRadius * Math.cos(radians)) }
}

/** Three decimals keep the path stable across engines without visible seams. */
function round(value: number) {
  return Math.round(value * 1000) / 1000
}
