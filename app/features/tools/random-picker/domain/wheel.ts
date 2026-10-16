import { randomPickerLimits } from './reference'

/**
 * The wheel's geometry, kept apart from the draw on purpose: it can say where a
 * slice sits and where the wheel has to stop for a given result, but it has no
 * way to choose one. Angles are degrees measured clockwise from the pointer at
 * the top, which is where the wheel is read.
 *
 * Since #106 the landing demo draws its wheel from this module too, so the two
 * cannot drift apart again: the same slices, colours, labels and pointer.
 */

export const wheelFullTurn = 360
/** Drawn in a unit circle so the component only has to place the viewBox. */
export const wheelRadius = 100
/** Room for the pointer above the rim, and the same on every side so the wheel stays centred. */
const wheelBounds = 124
export const wheelViewBox = `${-wheelBounds} ${-wheelBounds} ${wheelBounds * 2} ${wheelBounds * 2}`
/** The pointer overlaps the rim, so it reads as touching the slice it points at. */
export const wheelPointerPath = `M -12 ${-wheelRadius - 21} H 12 L 0 ${-wheelRadius + 3} Z`
export const wheelHubRadius = 17
export const wheelHubDotRadius = 6
/** How far the drawn slice stands out of the wheel once it has stopped. */
export const wheelWonOffset = 6

/**
 * The category fills of ADR-0020 in a fixed order, so neighbouring slices never
 * share a colour (except where a count wraps a white slice round to the first).
 * Ink on every one of them clears WCAG AA in both themes, because the fills do
 * not invert.
 */
export const wheelFills = ['paper', 'pink', 'sky', 'mint', 'coral'] as const

export type WheelFill = typeof wheelFills[number]

export interface WheelSlice {
  index: number
  label: string
  startAngle: number
  endAngle: number
  centreAngle: number
  fill: WheelFill
  /** Pie-slice path around the origin, for an SVG whose viewBox is centred there. */
  path: string
  /** Places and turns the slice's label; see `wheelLabelStyle` for how it turns. */
  labelTransform: string
  /**
   * Which way the label reads on screen once the wheel rests at the rotation it
   * was laid out for, in degrees clockwise from left-to-right. Always within
   * [-90, 90), so no name is ever drawn upside down.
   */
  labelTilt: number
  /** The offset that pulls the slice out of the wheel along its centre line, for the drawn one. */
  wonOffset: { x: number, y: number }
}

/** How a label is drawn once the wheel gets crowded enough to change the rules. */
export interface WheelLabelStyle {
  fontSize: number
  /**
   * Width a label keeps before it is clipped, in full-width characters: a
   * Chinese character counts as one, a Latin letter or digit as a little over
   * half. The list beside the wheel stays complete.
   */
  maxCharacters: number
  /**
   * Across the slice, the way the landing demo has always drawn names, reads
   * best; but only while the labels have room not to collide. A crowded wheel
   * lays them along the radius instead.
   */
  upright: boolean
}

export function wheelSliceAngle(count: number) {
  return wheelFullTurn / count
}

export function wheelSliceCentre(index: number, count: number) {
  return (index + 0.5) * wheelSliceAngle(count)
}

export function wheelSliceFill(index: number): WheelFill {
  return wheelFills[index % wheelFills.length]!
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
 * A short wheel writes its names large and across the slice, as the landing
 * demo does; a crowded one shrinks them and lays them along the radius so they
 * stop colliding. The thresholds are about legibility at the rendered size,
 * which is why they live with the geometry rather than with the reviewed list
 * ceilings.
 */
export function wheelLabelStyle(count: number): WheelLabelStyle {
  if (count > 24) return { fontSize: 5, maxCharacters: 4, upright: false }
  if (count > 12) return { fontSize: 7, maxCharacters: 6, upright: false }
  if (count > 6) return { fontSize: 11, maxCharacters: 6, upright: false }
  if (count > 3) return { fontSize: 15, maxCharacters: 4, upright: true }

  return { fontSize: 15, maxCharacters: 6, upright: true }
}

/** The ink between slices thins as they narrow, so a crowded wheel keeps its colours instead of turning black. */
export function wheelDividerWidth(count: number) {
  if (count > 24) return 1
  if (count > 12) return 1.5

  return 2.5
}

/**
 * Lays the labels out for the rotation the wheel will rest at, so every name
 * reads the right way up when it stops. A spin passes through other angles on
 * the way, but nobody reads a name mid-spin.
 */
export function wheelSlices(labels: readonly string[], restingRotation = 0): WheelSlice[] {
  const count = labels.length
  if (count < randomPickerLimits.wheelMinEntries) return []

  const style = wheelLabelStyle(count)

  return labels.map((label, index) => {
    const startAngle = index * wheelSliceAngle(count)
    const endAngle = startAngle + wheelSliceAngle(count)
    const centreAngle = wheelSliceCentre(index, count)
    const placement = labelPlacement(centreAngle, restingRotation, style.upright)
    const outward = wheelPoint(centreAngle, wheelWonOffset)

    return {
      index,
      label: clipLabel(label, style.maxCharacters),
      startAngle,
      endAngle,
      centreAngle,
      fill: wheelSliceFill(index),
      path: slicePath(startAngle, endAngle),
      labelTransform: placement.transform,
      labelTilt: placement.tilt,
      wonOffset: outward,
    }
  })
}

/** Whether a list can be read as a wheel at all, rather than only as text. */
export function canPresentWheel(entryCount: number, drawCount: number) {
  return drawCount === 1
    && entryCount >= randomPickerLimits.wheelMinEntries
    && entryCount <= randomPickerLimits.wheelMaxEntries
}

/**
 * A label across the slice sits nearer the rim, where the slice is widest; one
 * along the radius is centred between the hub and the rim so it can be longest.
 * Either is turned half a turn when it would otherwise read upside down at rest.
 */
function labelPlacement(centreAngle: number, restingRotation: number, upright: boolean) {
  const radius = upright ? 68 : 60
  const baseTurn = upright ? 0 : -90
  const restingTilt = normalizeAngle(centreAngle + restingRotation + baseTurn)
  const flipped = restingTilt >= 90 || restingTilt < -90
  const turn = baseTurn + (flipped ? 180 : 0)

  return {
    transform: `rotate(${round(centreAngle)}) translate(0 ${-radius}) rotate(${turn})`,
    tilt: flipped ? normalizeAngle(restingTilt + 180) : restingTilt,
  }
}

const fullWidth = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦…]|[\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u
/** Archivo's bold Latin letters and digits run a little over half the width of a Chinese character. */
const halfWidth = 0.6

function characterWidth(character: string) {
  return fullWidth.test(character) ? 1 : halfWidth
}

function clipLabel(label: string, maxCharacters: number) {
  const characters = [...label]
  const width = characters.reduce((total, character) => total + characterWidth(character), 0)
  if (width <= maxCharacters) return label

  // The ellipsis takes a full-width place of its own, so clipping is always visible.
  let kept = ''
  let used = 1
  for (const character of characters) {
    used += characterWidth(character)
    if (used > maxCharacters) break
    kept += character
  }

  return `${kept}…`
}

function slicePath(startAngle: number, endAngle: number) {
  const start = wheelPoint(startAngle, wheelRadius)
  const end = wheelPoint(endAngle, wheelRadius)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return `M 0 0 L ${start.x} ${start.y} A ${wheelRadius} ${wheelRadius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function wheelPoint(angle: number, distance: number) {
  const radians = (angle * Math.PI) / 180

  return { x: round(distance * Math.sin(radians)), y: round(-distance * Math.cos(radians)) }
}

/** Within (-180, 180], so a tilt can be compared without caring how many turns came first. */
function normalizeAngle(angle: number) {
  const turned = ((angle % wheelFullTurn) + wheelFullTurn) % wheelFullTurn

  return turned > 180 ? turned - wheelFullTurn : turned
}

/** Three decimals keep the path stable across engines without visible seams. */
function round(value: number) {
  return Math.round(value * 1000) / 1000
}
