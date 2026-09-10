import { describe, expect, it } from 'vitest'
import {
  admitWorkbenchFiles,
  advanceWorkbenchQueue,
  createWorkbenchQueue,
  goToWorkbenchStep,
  measureWorkbenchItem,
  planWorkbenchRuns,
  removeWorkbenchItem,
  resolveWorkbenchLaneLimits,
  resolveWorkbenchLimits,
  setWorkbenchQueuePurpose,
  updateWorkbenchItem,
  updateWorkbenchItems,
  workbenchLaneOf,
  workbenchQueueLimits,
  workbenchQueueOutputs,
  workbenchQueueProgress,
  updateWorkbenchPipeline,
  workbenchStepStatus,
  type WorkbenchQueue,
} from '@/features/tools/product-image-workbench/queue'
import {
  blockWorkbenchStep,
  completeWorkbenchStep,
  failWorkbenchStep,
  skipWorkbenchStep,
  startWorkbenchStep,
} from '@/features/tools/product-image-workbench/session'

const mib = 1024 * 1024

function queueOf(count: number, bytes = mib): WorkbenchQueue {
  return admitWorkbenchFiles(createWorkbenchQueue(), Array.from({ length: count }, () => ({ bytes }))).queue
}

/** Every item walks the same step, because a batch is configured once and applied to all. */
function everyItem(queue: WorkbenchQueue, step: 'import' | 'cutout' | 'layout' | 'brand' | 'compress') {
  return updateWorkbenchItems(queue, session => completeWorkbenchStep(startWorkbenchStep(session, step), step))
}

describe('批次的收件與上限', () => {
  it('收下的每個項目都有本機產生的識別與序號，且不持有檔名', () => {
    const { queue, accepted, rejected } = admitWorkbenchFiles(createWorkbenchQueue(), [{ bytes: mib }, { bytes: 2 * mib }])

    expect(rejected).toEqual([])
    expect(accepted.map(item => item.ordinal)).toEqual([1, 2])
    expect(queue.items.map(item => item.id)).toEqual(['item-1', 'item-2'])
    expect(JSON.stringify(queue)).not.toMatch(/blob:|data:|\.png|\.jpg/)
  })

  it('超過張數上限的檔案在開始前就被說明退回，已收下的不受影響', () => {
    const first = admitWorkbenchFiles(createWorkbenchQueue(), Array.from({ length: 20 }, () => ({ bytes: mib })))
    const second = admitWorkbenchFiles(first.queue, [{ bytes: mib }, { bytes: mib }])

    expect(first.queue.items).toHaveLength(20)
    expect(second.queue.items).toHaveLength(20)
    expect(second.rejected).toEqual([{ index: 0, code: 'too_many_items' }, { index: 1, code: 'too_many_items' }])
  })

  it('超過合計位元組上限的檔案被退回，仍收下放得下的那些', () => {
    const { queue, accepted, rejected } = admitWorkbenchFiles(createWorkbenchQueue(), [
      { bytes: 150 * mib },
      { bytes: 60 * mib },
      { bytes: 10 * mib },
    ])

    expect(accepted.map(item => item.bytes)).toEqual([150 * mib, 10 * mib])
    expect(rejected).toEqual([{ index: 1, code: 'batch_too_large' }])
    expect(queue.items).toHaveLength(2)
  })

  it('移除項目後，之後收下的項目仍拿到自己的序號，不重用已用過的編號', () => {
    const queue = removeWorkbenchItem(queueOf(2), 'item-1')
    const { queue: grown } = admitWorkbenchFiles(queue, [{ bytes: mib }])

    expect(grown.items.map(item => item.id)).toEqual(['item-2', 'item-3'])
    expect(grown.items.map(item => item.ordinal)).toEqual([2, 3])
  })

  it('上限依裝置能力下修，回報的數字就是使用者看到的數字', () => {
    expect(resolveWorkbenchLimits({})).toEqual(workbenchQueueLimits)
    expect(resolveWorkbenchLimits({ deviceMemory: 8 })).toEqual(workbenchQueueLimits)

    const small = resolveWorkbenchLimits({ deviceMemory: 0.5 })
    expect(small.maxBytes).toBeLessThan(workbenchQueueLimits.maxBytes)
    expect(small.maxItems).toBeLessThan(workbenchQueueLimits.maxItems)
    expect(small.maxItems).toBeGreaterThan(0)
  })

  it('量到的尺寸超過本機上限的項目在開始前就標成不能處理，其餘項目照常', () => {
    const measured = measureWorkbenchItem(queueOf(2), 'item-1', { width: 12_000, height: 12_000 })

    expect(measured.items[0]!.session.states.import).toBe('failed')
    expect(measured.items[0]!.session.errors.import).toBe('too_large')
    expect(measured.items[1]!.session.states.import).toBe('ready')
    expect(planWorkbenchRuns(measured, 'import', { running: [], limit: 2 })).toEqual(['item-2'])
  })
})

describe('批次的彙總狀態', () => {
  it('步驟軌顯示彙總狀態與逐項計數，有一項在跑就是處理中', () => {
    const queue = updateWorkbenchItem(everyItem(queueOf(3), 'import'), 'item-1', session => startWorkbenchStep(session, 'cutout'))
    const status = workbenchStepStatus(queue, 'cutout')

    expect(status.state).toBe('running')
    expect(status.counts).toMatchObject({ running: 1, ready: 2 })
    expect(status.reachable).toBe(true)
  })

  it('一項失敗不影響其他項目，步驟仍算可以繼續', () => {
    const imported = everyItem(queueOf(3), 'import')
    const queue = updateWorkbenchItem(imported, 'item-2', session => failWorkbenchStep(startWorkbenchStep(session, 'cutout'), 'cutout', 'inference_failed'))
    const cutout = updateWorkbenchItems(queue, session => session.states.cutout === 'ready' ? skipWorkbenchStep(session, 'cutout') : session)

    expect(workbenchStepStatus(cutout, 'cutout').counts).toMatchObject({ failed: 1, skipped: 2 })
    expect(workbenchStepStatus(cutout, 'layout').state).toBe('ready')
    expect(workbenchStepStatus(cutout, 'layout').counts).toMatchObject({ ready: 2, locked: 1 })
  })

  it('彙總進度以項目為單位，明確區分完成、未完成與尚未開始', () => {
    const laidOut = everyItem(everyItem(everyItem(queueOf(3), 'import'), 'cutout'), 'layout')
    const settled = updateWorkbenchItems(laidOut, session => skipWorkbenchStep(session, 'compress'))
    const queue = updateWorkbenchItem(settled, 'item-3', session => failWorkbenchStep(startWorkbenchStep(session, 'layout'), 'layout', 'encode_failed'))

    expect(workbenchQueueProgress(queue)).toEqual({ total: 3, done: 2, failed: 1, running: 0, pending: 0 })
    expect(workbenchQueueOutputs(queue).map(entry => entry.id)).toEqual(['item-1', 'item-2'])
    expect(workbenchQueueOutputs(queue).every(entry => entry.step === 'layout')).toBe(true)
  })

  it('用途改變會套用到批次裡的每個項目，不會只改到其中一個', () => {
    const queue = setWorkbenchQueuePurpose(everyItem(queueOf(2), 'import'), 'promotional')

    expect(queue.purpose).toBe('promotional')
    expect(queue.items.every(item => item.session.purpose === 'promotional')).toBe(true)
    expect(workbenchStepStatus(queue, 'brand').state).toBe('locked')
    expect(workbenchStepStatus(queue, 'compress').state).toBe('locked')
  })

  it('品牌素材由分支決定；壓縮不是分支的事，因此佇列不會只因用途就停用它', () => {
    expect(workbenchStepStatus(queueOf(1), 'brand').state).toBe('unavailable')
    expect(workbenchStepStatus(queueOf(1), 'compress').state).toBe('locked')
    expect(workbenchStepStatus(setWorkbenchQueuePurpose(queueOf(1), 'promotional'), 'brand').state).toBe('locked')
  })

  it('還沒有圖片時，佇列仍說得出這條流程有哪些步驟，之後收下的項目也照這個形狀開始', () => {
    const empty = createWorkbenchQueue()

    expect(workbenchStepStatus(empty, 'import').state).toBe('ready')
    expect(workbenchStepStatus(empty, 'brand').state).toBe('unavailable')

    const blocked = updateWorkbenchPipeline(empty, session => blockWorkbenchStep(session, 'cutout', 'capability'))
    expect(workbenchStepStatus(blocked, 'cutout').state).toBe('unavailable')

    const { queue } = admitWorkbenchFiles(blocked, [{ bytes: mib }])
    expect(queue.items[0]!.session.states.cutout).toBe('unavailable')
    expect(queue.items[0]!.session.blocked.cutout).toBe('capability')
  })

  it('只能移動到已開放的步驟，空佇列停在匯入', () => {
    const queue = everyItem(queueOf(1), 'import')

    expect(goToWorkbenchStep(queue, 'cutout').current).toBe('cutout')
    expect(goToWorkbenchStep(createWorkbenchQueue(), 'layout').current).toBe('import')
  })

  it('有項目完成這一步才往下走；全部失敗時留在原地', () => {
    const imported = everyItem(queueOf(2), 'import')

    expect(advanceWorkbenchQueue(imported, 'import').current).toBe('cutout')

    const allFailed = updateWorkbenchItems(queueOf(2), session => failWorkbenchStep(session, 'import', 'too_large'))
    expect(advanceWorkbenchQueue(allFailed, 'import').current).toBe('import')

    // A merchant who moved on themselves is not moved again.
    expect(advanceWorkbenchQueue(goToWorkbenchStep(imported, 'cutout'), 'import').current).toBe('cutout')
  })
})

describe('併發上限', () => {
  it('推論與編碼分屬不同通道，各自有自己的上限', () => {
    expect(workbenchLaneOf('cutout')).toBe('inference')
    expect(workbenchLaneOf('layout')).toBe('codec')
    expect(workbenchLaneOf('compress')).toBe('codec')
    expect(workbenchLaneOf('import')).toBeUndefined()

    expect(resolveWorkbenchLaneLimits({ hardwareConcurrency: 8 })).toEqual({ inference: 1, codec: 2 })
    expect(resolveWorkbenchLaneLimits({ hardwareConcurrency: 2 })).toEqual({ inference: 1, codec: 1 })
    expect(resolveWorkbenchLaneLimits({})).toEqual({ inference: 1, codec: 2 })
  })

  it('依序取用未開始的項目，同時進行的數量不超過通道上限', () => {
    const queue = everyItem(queueOf(5), 'import')

    expect(planWorkbenchRuns(queue, 'cutout', { running: [], limit: 1 })).toEqual(['item-1'])
    expect(planWorkbenchRuns(queue, 'cutout', { running: ['item-1'], limit: 1 })).toEqual([])
    expect(planWorkbenchRuns(queue, 'layout', { running: [], limit: 2 })).toEqual([])
  })

  it('已完成、失敗與正在進行的項目都不會被重複排入', () => {
    const imported = everyItem(queueOf(4), 'import')
    const queue = updateWorkbenchItem(
      updateWorkbenchItem(imported, 'item-1', session => completeWorkbenchStep(startWorkbenchStep(session, 'cutout'), 'cutout')),
      'item-2',
      session => failWorkbenchStep(startWorkbenchStep(session, 'cutout'), 'cutout', 'inference_failed'),
    )

    expect(planWorkbenchRuns(queue, 'cutout', { running: ['item-3'], limit: 2 })).toEqual(['item-4'])
  })
})
