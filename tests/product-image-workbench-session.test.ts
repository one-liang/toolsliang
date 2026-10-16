import { describe, expect, it } from 'vitest'
import {
  blockWorkbenchStep,
  completeWorkbenchStep,
  createWorkbenchSession,
  failWorkbenchStep,
  finalWorkbenchArtifact,
  isWorkbenchStepReachable,
  noteWorkbenchStepError,
  resetWorkbenchStep,
  skipWorkbenchStep,
  startWorkbenchStep,
  unblockWorkbenchStep,
  workbenchProgress,
  workbenchSteps,
  type WorkbenchSession,
} from '@/features/tools/product-image-workbench/session'

function importDone(session = createWorkbenchSession()) {
  return completeWorkbenchStep(startWorkbenchStep(session, 'import'), 'import')
}

/** Import, skip the cutout, lay out. */
function laidOut(session = createWorkbenchSession()) {
  const afterCutout = skipWorkbenchStep(importDone(session), 'cutout')
  return completeWorkbenchStep(startWorkbenchStep(afterCutout, 'layout'), 'layout')
}

describe('工作階段的步驟順序', () => {
  it('新的工作階段只開放匯入，其餘六個步驟都在，沒有任何一步因用途被拿掉', () => {
    const session = createWorkbenchSession()

    expect(session.states).toEqual({
      import: 'ready',
      cutout: 'locked',
      layout: 'locked',
      brand: 'locked',
      compress: 'locked',
      output: 'locked',
    })
    expect(session.blocked).toEqual({})
    expect(session).not.toHaveProperty('purpose')
  })

  it('完成一個步驟才開放下一個步驟', () => {
    const session = importDone()

    expect(session.states.import).toBe('done')
    expect(session.states.cutout).toBe('ready')
    expect(session.states.layout).toBe('locked')
  })

  it('略過選用步驟等同完成，仍會開放下一步', () => {
    const session = skipWorkbenchStep(importDone(), 'cutout')

    expect(session.states.cutout).toBe('skipped')
    expect(session.states.layout).toBe('ready')
  })

  it('必要步驟不可略過', () => {
    const session = createWorkbenchSession()

    expect(skipWorkbenchStep(session, 'import')).toBe(session)
    expect(skipWorkbenchStep(laidOut(), 'layout').states.layout).toBe('done')
  })

  it('略過品牌素材與壓縮時，版型結果就是可下載的輸出', () => {
    const session = skipWorkbenchStep(skipWorkbenchStep(laidOut(), 'brand'), 'compress')

    expect(session.states.output).toBe('done')
    expect(finalWorkbenchArtifact(session)).toBe('layout')
  })

  it('版型之後才開放品牌素材與壓縮，輸出等兩者都有結論', () => {
    const afterLayout = laidOut()

    expect(afterLayout.states.brand).toBe('ready')
    expect(afterLayout.states.compress).toBe('locked')
    expect(afterLayout.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(afterLayout)).toBeUndefined()

    const branded = completeWorkbenchStep(startWorkbenchStep(afterLayout, 'brand'), 'brand')
    expect(branded.states.compress).toBe('ready')
    expect(branded.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(branded)).toBeUndefined()

    const skipped = skipWorkbenchStep(branded, 'compress')
    expect(skipped.states.output).toBe('done')
    expect(finalWorkbenchArtifact(skipped)).toBe('brand')
  })

  it('壓縮結果是最後產生的檔案，取代品牌素材的結果成為下載的輸出', () => {
    const branded = completeWorkbenchStep(startWorkbenchStep(laidOut(), 'brand'), 'brand')
    const compressed = completeWorkbenchStep(startWorkbenchStep(branded, 'compress'), 'compress')

    expect(compressed.states.output).toBe('done')
    expect(finalWorkbenchArtifact(compressed)).toBe('compress')
  })
})

describe('步驟失敗與取消的隔離', () => {
  it('步驟失敗只記錄該步驟的錯誤，先前成果保留且可重試', () => {
    const failed = failWorkbenchStep(startWorkbenchStep(importDone(), 'cutout'), 'cutout', 'inference_failed')

    expect(failed.states.import).toBe('done')
    expect(failed.states.cutout).toBe('failed')
    expect(failed.errors.cutout).toBe('inference_failed')
    expect(isWorkbenchStepReachable(failed, 'cutout')).toBe(true)

    const retried = startWorkbenchStep(failed, 'cutout')
    expect(retried.states.cutout).toBe('running')
    expect(retried.errors.cutout).toBeUndefined()
  })

  it('被拒絕的輸入只說明原因，不推翻該步驟既有的成果', () => {
    const noted = noteWorkbenchStepError(importDone(), 'import', 'unsupported_heic')

    expect(noted.states.import).toBe('done')
    expect(noted.states.cutout).toBe('ready')
    expect(noted.errors.import).toBe('unsupported_heic')
  })

  it('取消把步驟交還給使用者，不留下錯誤也不動先前成果', () => {
    const cancelled = resetWorkbenchStep(startWorkbenchStep(importDone(), 'cutout'), 'cutout')

    expect(cancelled.states.import).toBe('done')
    expect(cancelled.states.cutout).toBe('ready')
    expect(cancelled.errors.cutout).toBeUndefined()
  })

  it('改設定與取消走同一條路：步驟交還給使用者，下游成果同時作廢', () => {
    const changed = resetWorkbenchStep(laidOut(), 'layout')

    expect(changed.states.layout).toBe('ready')
    expect(changed.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(changed)).toBeUndefined()
  })

  it('重新執行上游步驟會作廢下游成果，避免拿舊結果當新結果', () => {
    const restarted = startWorkbenchStep(laidOut(), 'layout')

    expect(restarted.states.layout).toBe('running')
    expect(restarted.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(restarted)).toBeUndefined()
    expect(restarted.states.import).toBe('done')
    expect(restarted.states.cutout).toBe('skipped')
  })

  it('失敗的步驟不會讓下游看起來仍可下載', () => {
    const failed = failWorkbenchStep(startWorkbenchStep(laidOut(), 'layout'), 'layout', 'encode_failed')

    expect(failed.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(failed)).toBeUndefined()
  })
})

describe('能力不足只停用受影響的步驟', () => {
  it('去背不可用時仍可完成版型與輸出', () => {
    const blocked = blockWorkbenchStep(importDone(), 'cutout', 'capability')

    expect(blocked.states.cutout).toBe('unavailable')
    expect(blocked.blocked.cutout).toBe('capability')
    expect(blocked.states.layout).toBe('ready')
    expect(workbenchProgress(blocked)).toEqual({ completed: 1, total: 5 })

    const afterLayout = completeWorkbenchStep(startWorkbenchStep(blocked, 'layout'), 'layout')
    const output = skipWorkbenchStep(skipWorkbenchStep(afterLayout, 'brand'), 'compress')
    expect(output.states.output).toBe('done')
  })

  it('必要步驟不可用時，這條流程就到此為止，不會出現無法產生的輸出', () => {
    const blocked = blockWorkbenchStep(importDone(), 'layout', 'capability')

    expect(blocked.states.layout).toBe('unavailable')
    expect(blocked.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(blocked)).toBeUndefined()
    // The cutout is before it, so it is still offered.
    expect(blocked.states.cutout).toBe('ready')
  })

  it('能力恢復後步驟回到可用，並重新鎖住尚未重做的下游', () => {
    const blocked = blockWorkbenchStep(importDone(), 'cutout', 'capability')
    const restored = unblockWorkbenchStep(blocked, 'cutout')

    expect(restored.states.cutout).toBe('ready')
    expect(restored.blocked.cutout).toBeUndefined()
    expect(restored.states.layout).toBe('locked')
  })

  it('品牌素材引擎不可用時，仍能輸出版型結果', () => {
    const blocked = blockWorkbenchStep(laidOut(), 'brand', 'capability')

    expect(blocked.states.brand).toBe('unavailable')
    // The step after it is simply next in line; a missing engine never ends the run.
    expect(blocked.states.compress).toBe('ready')
    expect(skipWorkbenchStep(blocked, 'compress').states.output).toBe('done')
    expect(finalWorkbenchArtifact(skipWorkbenchStep(blocked, 'compress'))).toBe('layout')
  })
})

describe('回到前一步與進度', () => {
  it('尚未開放的步驟不可進入', () => {
    expect(isWorkbenchStepReachable(createWorkbenchSession(), 'layout')).toBe(false)
    expect(isWorkbenchStepReachable(laidOut(), 'layout')).toBe(true)
  })

  it('進度只計算實際適用的步驟', () => {
    expect(workbenchProgress(createWorkbenchSession())).toEqual({ completed: 0, total: 6 })
    expect(workbenchProgress(laidOut())).toEqual({ completed: 3, total: 6 })
    expect(workbenchProgress(skipWorkbenchStep(skipWorkbenchStep(laidOut(), 'brand'), 'compress'))).toEqual({ completed: 6, total: 6 })
    expect(workbenchProgress(blockWorkbenchStep(createWorkbenchSession(), 'cutout', 'capability'))).toEqual({ completed: 0, total: 5 })
  })

  it('工作階段只記錄步驟狀態，不持有任何工具內容，也不記錄閱讀位置', () => {
    const session: WorkbenchSession = laidOut()

    expect(workbenchSteps).toEqual(['import', 'cutout', 'layout', 'brand', 'compress', 'output'])
    expect(JSON.stringify(session)).not.toMatch(/blob:|data:|File|\.png/)
  })
})
