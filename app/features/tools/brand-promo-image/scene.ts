export const promoLayerKinds = ['background', 'product', 'frame', 'logo'] as const
export type PromoLayerKind = typeof promoLayerKinds[number]
export interface PromoLayer {
  id: string
  kind: PromoLayerKind
  assetId: string
  x: number
  y: number
  /** Horizontal scale of the fitted image; also the vertical one unless `scaleY` says otherwise. */
  scale: number
  /** Set only once the layer has been stretched out of its own proportions. */
  scaleY?: number
  opacity: number
  visible: boolean
  fit: 'contain' | 'cover'
}
export interface PromoScene { width: number, height: number, layers: PromoLayer[] }

/** The renderer accepts scales in this range, so every gesture stays inside it. */
export const promoScaleRange = { min: 0.01, max: 4 } as const

export function createPromoLayer(kind: PromoLayerKind, assetId: string): PromoLayer {
  return { id: crypto.randomUUID(), kind, assetId, x: 0, y: 0, scale: 1, opacity: 1, visible: true, fit: kind === 'background' ? 'cover' : 'contain' }
}

function fitRatio(layer: PromoLayer, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  return (layer.fit === 'cover' ? Math.max : Math.min)(width / sourceWidth, height / sourceHeight)
}

/** Transforms are shares of the canvas, from the centred fitted image. */
export function promoPlacement(layer: PromoLayer, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const ratio = fitRatio(layer, sourceWidth, sourceHeight, width, height)
  const fittedWidth = sourceWidth * ratio * layer.scale, fittedHeight = sourceHeight * ratio * (layer.scaleY ?? layer.scale)
  return { x: (width - fittedWidth) / 2 + width * layer.x, y: (height - fittedHeight) / 2 + height * layer.y, width: fittedWidth, height: fittedHeight }
}

const clampShare = (value: number) => Math.min(Math.max(value, -1), 1)

/**
 * A pointer drag on the preview, in canvas pixels from where it began. Holding
 * Shift keeps the move on whichever axis it has travelled further, as in an
 * image editor; the renderer accepts at most one canvas of offset each way.
 */
export function movePromoLayer(origin: PromoLayer, delta: { x: number, y: number }, canvas: { width: number, height: number }, { constrain = false } = {}): Pick<PromoLayer, 'x' | 'y'> {
  const dx = constrain && Math.abs(delta.y) > Math.abs(delta.x) ? 0 : delta.x
  const dy = constrain && Math.abs(delta.x) >= Math.abs(delta.y) ? 0 : delta.y
  return { x: clampShare(origin.x + dx / canvas.width), y: clampShare(origin.y + dy / canvas.height) }
}

export const promoHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
export type PromoHandle = typeof promoHandles[number]

/**
 * A transform handle dragged `delta` canvas pixels from where it began.
 *
 * Corners scale proportionally unless `proportional` is off (Shift in the
 * editor); edges stretch one axis. The opposite corner or edge stays put, or
 * the centre does when `fromCenter` is set (Alt in the editor). A stretched
 * layer keeps its stretch when scaled proportionally, and a layer whose two
 * scales meet again drops `scaleY` so it reads as unstretched.
 */
export function resizePromoLayer(
  origin: PromoLayer,
  handle: PromoHandle,
  delta: { x: number, y: number },
  source: { width: number, height: number },
  canvas: { width: number, height: number },
  { proportional = true, fromCenter = false } = {},
): Pick<PromoLayer, 'x' | 'y' | 'scale' | 'scaleY'> {
  const box = promoPlacement(origin, source.width, source.height, canvas.width, canvas.height)
  const ratio = fitRatio(origin, source.width, source.height, canvas.width, canvas.height)
  const unit = { width: source.width * ratio, height: source.height * ratio }
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
  const reach = fromCenter ? 2 : 1
  const clampWidth = (value: number) => Math.min(Math.max(value, unit.width * promoScaleRange.min), unit.width * promoScaleRange.max)
  const clampHeight = (value: number) => Math.min(Math.max(value, unit.height * promoScaleRange.min), unit.height * promoScaleRange.max)

  let width = sx ? clampWidth(box.width + sx * delta.x * reach) : box.width
  let height = sy ? clampHeight(box.height + sy * delta.y * reach) : box.height
  if (proportional && sx && sy) {
    /* The pointer is projected onto the diagonal, so the corner follows the hand in either direction. */
    const wanted = { width: box.width + sx * delta.x * reach, height: box.height + sy * delta.y * reach }
    const factor = (wanted.width * box.width + wanted.height * box.height) / (box.width ** 2 + box.height ** 2)
    const floor = Math.max(clampWidth(0) / box.width, clampHeight(0) / box.height)
    const ceiling = Math.min(clampWidth(Infinity) / box.width, clampHeight(Infinity) / box.height)
    const bounded = Math.min(Math.max(factor, floor), ceiling)
    width = box.width * bounded
    height = box.height * bounded
  }

  const centreX = fromCenter || !sx ? box.x + box.width / 2 : sx > 0 ? box.x + width / 2 : box.x + box.width - width / 2
  const centreY = fromCenter || !sy ? box.y + box.height / 2 : sy > 0 ? box.y + height / 2 : box.y + box.height - height / 2
  /* Clamped again because floating point can land a hair outside the range the renderer accepts. */
  const clampScale = (value: number) => Math.min(Math.max(value, promoScaleRange.min), promoScaleRange.max)
  const scale = clampScale(width / unit.width)
  const scaleY = clampScale(height / unit.height)

  return {
    x: clampShare((centreX - canvas.width / 2) / canvas.width),
    y: clampShare((centreY - canvas.height / 2) / canvas.height),
    scale,
    scaleY: Math.abs(scaleY - scale) < 1e-6 ? undefined : scaleY,
  }
}

/** Moves one layer to a position in the back-to-front order, or returns the same list when nothing changes. */
export function reorderPromoLayers(layers: PromoLayer[], id: string, index: number): PromoLayer[] {
  const from = layers.findIndex(layer => layer.id === id)
  const target = Math.min(Math.max(index, 0), layers.length - 1)
  if (from < 0 || from === target) return layers
  const next = [...layers]
  const [layer] = next.splice(from, 1)
  next.splice(target, 0, layer!)
  return next
}

/**
 * Which layer a click on the preview means, like an image editor's auto-select:
 * the topmost visible layer with paint under the pointer, so the transparent
 * middle of a frame lets the product beneath be picked. A click on nothing but
 * transparent pixels falls back to the selected layer's box, then to the
 * topmost box under the pointer.
 */
export function pickPromoLayer(
  layers: PromoLayer[],
  point: { x: number, y: number },
  {
    boxOf,
    opaqueAt,
    selectedId,
  }: {
    boxOf: (layer: PromoLayer) => { x: number, y: number, width: number, height: number } | undefined
    opaqueAt: (layer: PromoLayer, u: number, v: number) => boolean
    selectedId?: string
  },
): PromoLayer | undefined {
  const hits: PromoLayer[] = []
  for (const layer of [...layers].reverse()) {
    if (!layer.visible) continue
    const box = boxOf(layer)
    if (!box || box.width <= 0 || box.height <= 0) continue
    const u = (point.x - box.x) / box.width, v = (point.y - box.y) / box.height
    if (u < 0 || u > 1 || v < 0 || v > 1) continue
    if (opaqueAt(layer, u, v)) return layer
    hits.push(layer)
  }
  return hits.find(layer => layer.id === selectedId) ?? hits[0]
}

export function serializePromoScene(scene: PromoScene) { return JSON.stringify(scene) }

/** History holds references and transforms only; never another copy of image bytes. */
export function createPromoHistory(initial: PromoScene) {
  const snapshots = [serializePromoScene(initial)]
  let index = 0
  return {
    get scene(): PromoScene { return JSON.parse(snapshots[index]!) },
    get canUndo() { return index > 0 },
    get canRedo() { return index < snapshots.length - 1 },
    commit(scene: PromoScene) {
      const snapshot = serializePromoScene(scene)
      if (snapshot === snapshots[index]) return
      snapshots.splice(index + 1)
      snapshots.push(snapshot)
      if (snapshots.length > 100) snapshots.shift()
      index = snapshots.length - 1
    },
    undo() { if (index > 0) index-- },
    redo() { if (index < snapshots.length - 1) index++ },
  }
}
