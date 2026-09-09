import { describe, expect, it } from 'vitest'
import {
  blockWorkbenchStep,
  completeWorkbenchStep,
  createWorkbenchSession,
  failWorkbenchStep,
  finalWorkbenchArtifact,
  goToWorkbenchStep,
  isWorkbenchStepReachable,
  noteWorkbenchStepError,
  resetWorkbenchStep,
  setWorkbenchPurpose,
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

/** The compliant branch: import, skip the cutout, lay out, download. */
function compliantOutput(session = createWorkbenchSession()) {
  const afterCutout = skipWorkbenchStep(importDone(session), 'cutout')
  return completeWorkbenchStep(startWorkbenchStep(afterCutout, 'layout'), 'layout')
}

describe('工作階段的步驟順序', () => {
  it('新的工作階段只開放匯入，合規主圖分支不提供品牌素材步驟', () => {
    const session = createWorkbenchSession()

    expect(session.purpose).toBe('compliant')
    expect(session.current).toBe('import')
    expect(session.states).toEqual({
      import: 'ready',
      cutout: 'locked',
      layout: 'locked',
      brand: 'unavailable',
      output: 'locked',
    })
    expect(session.blocked.brand).toBe('purpose')
  })

  it('完成一個步驟才開放下一個步驟，並把焦點移到新開放的步驟', () => {
    const session = importDone()

    expect(session.states.import).toBe('done')
    expect(session.states.cutout).toBe('ready')
    expect(session.states.layout).toBe('locked')
    expect(session.current).toBe('cutout')
  })

  it('略過選用步驟等同完成，仍會開放下一步', () => {
    const session = skipWorkbenchStep(importDone(), 'cutout')

    expect(session.states.cutout).toBe('skipped')
    expect(session.states.layout).toBe('ready')
    expect(session.current).toBe('layout')
  })

  it('必要步驟不可略過', () => {
    const session = createWorkbenchSession()

    expect(skipWorkbenchStep(session, 'import')).toBe(session)
    expect(skipWorkbenchStep(compliantOutput(), 'layout').states.layout).toBe('done')
  })

  it('合規主圖完成版型後直接產生可下載的輸出', () => {
    const session = compliantOutput()

    expect(session.states.brand).toBe('unavailable')
    expect(session.states.output).toBe('done')
    expect(session.current).toBe('output')
    expect(finalWorkbenchArtifact(session)).toBe('layout')
  })

  it('品牌宣傳圖分支在版型之後才開放品牌素材，輸出等品牌素材完成', () => {
    const promotional = setWorkbenchPurpose(createWorkbenchSession(), 'promotional')
    const laidOut = compliantOutput(promotional)

    expect(laidOut.states.brand).toBe('ready')
    expect(laidOut.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(laidOut)).toBeUndefined()

    const branded = completeWorkbenchStep(startWorkbenchStep(laidOut, 'brand'), 'brand')
    expect(branded.states.output).toBe('done')
    expect(finalWorkbenchArtifact(branded)).toBe('brand')
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
    const changed = resetWorkbenchStep(compliantOutput(), 'layout')

    expect(changed.states.layout).toBe('ready')
    expect(changed.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(changed)).toBeUndefined()
    // The output panel just closed, so the merchant is moved to the step they can act on.
    expect(changed.current).toBe('layout')
  })

  it('重新執行上游步驟會作廢下游成果，避免拿舊結果當新結果', () => {
    const restarted = startWorkbenchStep(compliantOutput(), 'layout')

    expect(restarted.states.layout).toBe('running')
    expect(restarted.states.output).toBe('locked')
    expect(finalWorkbenchArtifact(restarted)).toBeUndefined()
    expect(restarted.states.import).toBe('done')
    expect(restarted.states.cutout).toBe('skipped')
  })

  it('失敗的步驟不會讓下游看起來仍可下載', () => {
    const failed = failWorkbenchStep(startWorkbenchStep(compliantOutput(), 'layout'), 'layout', 'encode_failed')

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
    expect(blocked.current).toBe('layout')
    expect(workbenchProgress(blocked)).toEqual({ completed: 1, total: 3 })

    const output = completeWorkbenchStep(startWorkbenchStep(blocked, 'layout'), 'layout')
    expect(output.states.output).toBe('done')
  })

  it('能力恢復後步驟回到可用，並重新鎖住尚未重做的下游', () => {
    const blocked = blockWorkbenchStep(importDone(), 'cutout', 'capability')
    const restored = unblockWorkbenchStep(blocked, 'cutout')

    expect(restored.states.cutout).toBe('ready')
    expect(restored.blocked.cutout).toBeUndefined()
    expect(restored.states.layout).toBe('locked')
  })

  it('品牌素材引擎不可用時，品牌宣傳圖分支仍能輸出版型結果', () => {
    const promotional = setWorkbenchPurpose(createWorkbenchSession(), 'promotional')
    const blocked = blockWorkbenchStep(compliantOutput(promotional), 'brand', 'capability')

    expect(blocked.states.brand).toBe('unavailable')
    expect(blocked.states.output).toBe('done')
    expect(finalWorkbenchArtifact(blocked)).toBe('layout')
  })
})

describe('回到前一步與進度', () => {
  it('可以回到已完成的步驟，但不能跳到尚未開放的步驟', () => {
    const session = compliantOutput()

    expect(goToWorkbenchStep(session, 'import').current).toBe('import')
    expect(goToWorkbenchStep(createWorkbenchSession(), 'layout').current).toBe('import')
    expect(isWorkbenchStepReachable(createWorkbenchSession(), 'layout')).toBe(false)
  })

  it('切換用途保留匯入與去背成果，只作廢版型之後的步驟', () => {
    const switched = setWorkbenchPurpose(compliantOutput(), 'promotional')

    expect(switched.states.import).toBe('done')
    expect(switched.states.cutout).toBe('skipped')
    expect(switched.states.layout).toBe('ready')
    expect(switched.states.brand).toBe('locked')
    expect(switched.states.output).toBe('locked')
    expect(switched.current).toBe('layout')
    expect(switched.blocked.brand).toBeUndefined()
  })

  it('進度只計算這個分支實際適用的步驟', () => {
    expect(workbenchProgress(createWorkbenchSession())).toEqual({ completed: 0, total: 4 })
    expect(workbenchProgress(compliantOutput())).toEqual({ completed: 4, total: 4 })

    const promotional = setWorkbenchPurpose(createWorkbenchSession(), 'promotional')
    expect(workbenchProgress(promotional)).toEqual({ completed: 0, total: 5 })
    expect(workbenchProgress(compliantOutput(promotional))).toEqual({ completed: 3, total: 5 })
  })

  it('工作階段只記錄步驟狀態，不持有任何工具內容', () => {
    const session: WorkbenchSession = compliantOutput()

    expect(workbenchSteps).toEqual(['import', 'cutout', 'layout', 'brand', 'output'])
    expect(JSON.stringify(session)).not.toMatch(/blob:|data:|File|\.png/)
  })
})
