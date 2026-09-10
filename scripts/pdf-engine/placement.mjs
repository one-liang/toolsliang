/**
 * The placement arithmetic the harness measures.
 *
 * `app/features/tools/pdf-signature/domain/reference.ts` carries the same rules
 * for the tool to use. Two copies exist because one is a browser module the
 * harness loads and the other is the typed domain module the application
 * imports; `tests/pdf-signature-reference.test.ts` runs both over the same grid
 * of pages and rectangles and fails if they ever disagree. The evaluation's
 * evidence is therefore evidence about the exported functions, not about a
 * private copy that happens to resemble them.
 */

function quarterTurn(rotation) {
  const normalized = ((Math.trunc(rotation) % 360) + 360) % 360
  if (normalized !== 0 && normalized !== 90 && normalized !== 180 && normalized !== 270) {
    throw new Error(`unsupported_rotation:${rotation}`)
  }
  return normalized
}

/** The box a viewer shows: the visible box, turned by the page's own `/Rotate`. */
export function displayBox(page) {
  const rotation = quarterTurn(page.rotation)
  const width = page.box[2] - page.box[0]
  const height = page.box[3] - page.box[1]

  return rotation === 90 || rotation === 270
    ? { width: height, height: width, rotation }
    : { width, height, rotation }
}

/** A point in display space, top-left origin, to the same point in PDF user space. */
export function displayPointToUserSpace(page, point) {
  const [x0, y0, x1, y1] = page.box
  const rotation = quarterTurn(page.rotation)

  if (rotation === 90) return { x: x0 + point.y, y: y0 + point.x }
  if (rotation === 180) return { x: x1 - point.x, y: y0 + point.y }
  if (rotation === 270) return { x: x1 - point.y, y: y1 - point.x }
  return { x: x0 + point.x, y: y1 - point.y }
}

/** The way back, for turning a stored placement into something to draw on screen. */
export function userSpaceToDisplayPoint(page, point) {
  const [x0, y0, x1, y1] = page.box
  const rotation = quarterTurn(page.rotation)

  if (rotation === 90) return { x: point.y - y0, y: point.x - x0 }
  if (rotation === 180) return { x: x1 - point.x, y: point.y - y0 }
  if (rotation === 270) return { x: y1 - point.y, y: x1 - point.x }
  return { x: point.x - x0, y: y1 - point.y }
}

/** Keeps a rectangle inside the page, moving it rather than shrinking it. */
export function clampNormalizedRect(rect) {
  const width = Math.min(Math.max(rect.width, 0), 1)
  const height = Math.min(Math.max(rect.height, 0), 1)

  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, 0), 1 - width),
    y: Math.min(Math.max(rect.y, 0), 1 - height),
  }
}

/** The size in points, the user-space anchor and the turn a writer needs. */
export function signaturePlacement(page, rect) {
  const display = displayBox(page)
  const clamped = clampNormalizedRect(rect)
  const width = clamped.width * display.width
  const height = clamped.height * display.height
  const left = clamped.x * display.width
  const top = clamped.y * display.height

  return {
    left,
    top,
    width,
    height,
    rotation: display.rotation,
    /* pdf-lib anchors an image at its own bottom-left corner and rotates about it. */
    anchor: displayPointToUserSpace(page, { x: left, y: top + height }),
    display: { width: display.width, height: display.height },
  }
}
