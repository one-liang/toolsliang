export const promoLayerKinds = ['background', 'product', 'frame', 'logo'] as const
export type PromoLayerKind = typeof promoLayerKinds[number]
export interface PromoLayer {
  id: string
  kind: PromoLayerKind
  assetId: string
  x: number
  y: number
  scale: number
  opacity: number
  visible: boolean
  fit: 'contain' | 'cover'
}
export interface PromoScene { width: number, height: number, layers: PromoLayer[] }

export function createPromoLayer(kind: PromoLayerKind, assetId: string): PromoLayer {
  return { id: crypto.randomUUID(), kind, assetId, x: 0, y: 0, scale: 1, opacity: 1, visible: true, fit: kind === 'background' ? 'cover' : 'contain' }
}

/** Transforms are shares of the canvas, from the centred fitted image. */
export function promoPlacement(layer: PromoLayer, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const ratio = (layer.fit === 'cover' ? Math.max : Math.min)(width / sourceWidth, height / sourceHeight) * layer.scale
  const fittedWidth = sourceWidth * ratio, fittedHeight = sourceHeight * ratio
  return { x: (width - fittedWidth) / 2 + width * layer.x, y: (height - fittedHeight) / 2 + height * layer.y, width: fittedWidth, height: fittedHeight }
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
