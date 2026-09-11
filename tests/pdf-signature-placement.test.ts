import { describe, expect, it } from 'vitest'
import {
  canUndoPlacement,
  createPdfWorkspace,
  movePlacement,
  nudgeStepPt,
  placeSignature,
  placementGeometry,
  placementHistoryLimit,
  placementSummary,
  removePlacement,
  resizePlacement,
  selectPlacement,
  setPlacementRect,
  signatureExportRequests,
  undoPlacement,
  type PdfWorkspacePage,
} from '@/features/tools/pdf-signature/domain/workspace'

const a4: PdfWorkspacePage = { index: 0, box: [0, 0, 595.28, 841.89], rotation: 0 }
const turned: PdfWorkspacePage = { index: 1, box: [0, 0, 595.28, 841.89], rotation: 90 }
const offset: PdfWorkspacePage = { index: 2, box: [20, 30, 420, 330], rotation: 0 }
const pages = [a4, turned, offset]

/** A wide signature, as a drawn one is: three times as wide as it is tall. */
const signature = { id: 'sig-1', width: 900, height: 300 }

function workspace() {
  return createPdfWorkspace(pages)
}

function place(page = 0) {
  return placeSignature(workspace(), { id: 'place-1', page, signature })
}

describe('放置簽名', () => {
  it('第一次放置時置於頁面下方中央，並保留簽名本身的長寬比', () => {
    const state = place()
    const geometry = placementGeometry(state, 'place-1')!

    expect(state.placements).toHaveLength(1)
    expect(state.selectedId).toBe('place-1')
    // Centred across the page, so the two margins are the same.
    expect(geometry.left).toBeCloseTo(geometry.display.width - geometry.left - geometry.width, 6)
    expect(geometry.width / geometry.height).toBeCloseTo(signature.width / signature.height, 6)
    expect(geometry.top + geometry.height).toBeLessThan(geometry.display.height)
  })

  it('在四分之一轉的頁面上以顯示後的邊長計算，簽名仍然是橫的', () => {
    const geometry = placementGeometry(place(1), 'place-1')!

    expect(geometry.display).toEqual({ width: 841.89, height: 595.28 })
    expect(geometry.rotation).toBe(90)
    expect(geometry.width).toBeGreaterThan(geometry.height)
  })

  it('偏移頁框的錨點落在頁框內，不以頁面原點計算', () => {
    const geometry = placementGeometry(place(2), 'place-1')!

    expect(geometry.anchor.x).toBeGreaterThanOrEqual(20)
    expect(geometry.anchor.y).toBeGreaterThanOrEqual(30)
    expect(geometry.anchor.x + geometry.width).toBeLessThanOrEqual(420)
  })

  it('同一頁可以有多個簽名，最後放置的是選取中的那一個', () => {
    const state = placeSignature(place(), { id: 'place-2', page: 0, signature })

    expect(state.placements.map(placement => placement.id)).toEqual(['place-1', 'place-2'])
    expect(state.selectedId).toBe('place-2')
  })

  it('不接受不存在的頁碼', () => {
    expect(() => placeSignature(workspace(), { id: 'place-x', page: 9, signature })).toThrow(/unknown_page/)
  })
})

describe('鍵盤與數值定位', () => {
  it('方向鍵移動以點為單位，粗調步距大於細調', () => {
    const state = place()
    const fine = placementGeometry(movePlacement(state, 'place-1', { x: nudgeStepPt.fine, y: 0 }), 'place-1')!
    const coarse = placementGeometry(movePlacement(state, 'place-1', { x: nudgeStepPt.coarse, y: 0 }), 'place-1')!
    const before = placementGeometry(state, 'place-1')!

    expect(fine.left - before.left).toBeCloseTo(nudgeStepPt.fine, 4)
    expect(coarse.left - before.left).toBeCloseTo(nudgeStepPt.coarse, 4)
    expect(nudgeStepPt.coarse).toBeGreaterThan(nudgeStepPt.fine)
  })

  it('移出頁面時貼齊邊緣而不是縮小，也不會掉出頁面', () => {
    const state = movePlacement(place(), 'place-1', { x: -10_000, y: 10_000 })
    const geometry = placementGeometry(state, 'place-1')!
    const before = placementGeometry(place(), 'place-1')!

    expect(geometry.left).toBeCloseTo(0, 6)
    expect(geometry.top + geometry.height).toBeCloseTo(geometry.display.height, 6)
    expect(geometry.width).toBeCloseTo(before.width, 6)
  })

  it('數值輸入直接設定位置與寬度，高度跟著簽名長寬比', () => {
    const state = setPlacementRect(place(), 'place-1', { leftPt: 100, topPt: 200, widthPt: 180 })
    const geometry = placementGeometry(state, 'place-1')!

    expect(geometry.left).toBeCloseTo(100, 4)
    expect(geometry.top).toBeCloseTo(200, 4)
    expect(geometry.width).toBeCloseTo(180, 4)
    expect(geometry.height).toBeCloseTo(60, 4)
  })

  it('縮放保留長寬比，且不超過頁面寬度', () => {
    const state = resizePlacement(place(), 'place-1', 4)
    const geometry = placementGeometry(state, 'place-1')!

    expect(geometry.width / geometry.height).toBeCloseTo(signature.width / signature.height, 6)
    expect(geometry.width).toBeLessThanOrEqual(geometry.display.width + 0.001)
  })

  it('縮到最小仍然看得見', () => {
    const geometry = placementGeometry(resizePlacement(place(), 'place-1', 0), 'place-1')!

    expect(geometry.width).toBeGreaterThan(8)
  })
})

describe('刪除與復原', () => {
  it('刪除後選取落在剩下的簽名上', () => {
    const two = placeSignature(place(), { id: 'place-2', page: 0, signature })
    const state = removePlacement(two, 'place-2')

    expect(state.placements.map(placement => placement.id)).toEqual(['place-1'])
    expect(state.selectedId).toBe('place-1')
  })

  it('復原可以逐步退回放置、移動與刪除', () => {
    const moved = movePlacement(place(), 'place-1', { x: 20, y: 0 })
    const deleted = removePlacement(moved, 'place-1')

    const afterDelete = undoPlacement(deleted)
    expect(afterDelete.placements).toHaveLength(1)
    expect(placementGeometry(afterDelete, 'place-1')!.left).toBeCloseTo(placementGeometry(moved, 'place-1')!.left, 6)

    const afterMove = undoPlacement(afterDelete)
    expect(placementGeometry(afterMove, 'place-1')!.left).toBeCloseTo(placementGeometry(place(), 'place-1')!.left, 6)

    expect(undoPlacement(afterMove).placements).toHaveLength(0)
    expect(undoPlacement(undoPlacement(afterMove)).placements).toHaveLength(0)
  })

  it('一次拖曳只留下一步：復原回到拖曳開始前的位置', () => {
    const start = place()
    const before = placementGeometry(start, 'place-1')!
    // One gesture, many pointer samples: only the first records where to go back to.
    let dragged = movePlacement(start, 'place-1', { x: 4, y: 0 })
    for (const step of [4, 4, 4, 4]) dragged = movePlacement(dragged, 'place-1', { x: step, y: 0 }, { continuing: true })

    expect(placementGeometry(dragged, 'place-1')!.left).toBeCloseTo(before.left + 20, 4)
    expect(dragged.history).toHaveLength(start.history.length + 1)
    expect(placementGeometry(undoPlacement(dragged), 'place-1')!.left).toBeCloseTo(before.left, 6)
  })

  it('復原紀錄有上限，長時間作業不會無限成長', () => {
    let state = place()
    for (let step = 0; step < placementHistoryLimit + 20; step += 1) {
      state = movePlacement(state, 'place-1', { x: 1, y: 0 })
    }

    expect(state.history).toHaveLength(placementHistoryLimit)
    expect(canUndoPlacement(state)).toBe(true)
  })

  it('選取與讀取不會寫進復原紀錄', () => {
    const state = selectPlacement(place(), 'place-1')

    expect(undoPlacement(state).placements).toHaveLength(0)
  })
})

describe('交給寫入引擎與說給使用者聽', () => {
  it('匯出請求只帶頁碼、正規化矩形與簽名識別碼', () => {
    const state = placeSignature(place(), { id: 'place-2', page: 2, signature })
    const requests = signatureExportRequests(state)

    expect(requests).toHaveLength(2)
    expect(Object.keys(requests[0]!).sort()).toEqual(['page', 'rect', 'signatureId'])
    expect(requests[1]!.page).toBe(2)
    for (const request of requests) {
      for (const value of Object.values(request.rect)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('位置摘要以頁碼與點數寫成句子，兩種語言都有', () => {
    const state = setPlacementRect(place(), 'place-1', { leftPt: 100, topPt: 200, widthPt: 180 })

    expect(placementSummary(state, 'place-1', 'zh-tw')).toBe('第 1 頁，距左 100 pt、距上 200 pt，寬 180 pt、高 60 pt')
    expect(placementSummary(state, 'place-1', 'en')).toBe('Page 1, 100 pt from the left, 200 pt from the top, 180 pt wide and 60 pt tall')
  })

  it('沒有選取時沒有幾何也沒有摘要', () => {
    expect(placementGeometry(workspace(), 'place-1')).toBeUndefined()
    expect(placementSummary(workspace(), 'place-1', 'zh-tw')).toBe('')
  })
})
