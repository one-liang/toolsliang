/**
 * The batch: many items, one configuration, one reading position.
 *
 * §12.11 asks for a resumable in-tab job graph with bounded concurrency,
 * per-item state, aggregate progress, cancel-all, cancel-item and retry. This
 * is that layer, and it owns none of the work: every item is a
 * `WorkbenchSession`, every transition is one of the session's own, and the
 * queue only decides who may start next and what the whole batch adds up to.
 *
 * It holds no file, no pixel and no name. An item is a locally generated id, a
 * position, its byte count — which is the only thing the shared limits can be
 * checked against before anything is decoded — and its own state.
 */
import { exceedsImageLimits } from '@/features/images/limits'
import {
  completeWorkbenchStep,
  createWorkbenchSession,
  failWorkbenchStep,
  finalWorkbenchArtifact,
  isWorkbenchStepReachable,
  setWorkbenchPurpose,
  workbenchSteps,
  type WorkbenchPurpose,
  type WorkbenchSession,
  type WorkbenchStep,
  type WorkbenchStepState,
} from './session'

export interface WorkbenchQueueLimits {
  maxItems: number
  maxBytes: number
}

/** §12.11's first-release ceiling, before this device is asked what it can hold. */
export const workbenchQueueLimits: WorkbenchQueueLimits = { maxItems: 20, maxBytes: 200 * 1024 * 1024 }

/**
 * A batch is held in memory from import to download, and every step adds a
 * result beside the source it came from, so the byte budget is a fraction of
 * what the device admits to having rather than the whole of it. `deviceMemory`
 * is coarse and absent in some browsers; when it says nothing, the shared
 * first-release ceiling stands, because a limit invented from silence is not
 * more careful, only more annoying.
 */
export function resolveWorkbenchLimits(device: { deviceMemory?: number }, base: WorkbenchQueueLimits = workbenchQueueLimits): WorkbenchQueueLimits {
  if (!device.deviceMemory) return { ...base }
  const maxBytes = Math.min(base.maxBytes, Math.round(device.deviceMemory * 1024 ** 3 / 8))

  return { maxBytes, maxItems: Math.max(1, Math.min(base.maxItems, Math.round(base.maxItems * maxBytes / base.maxBytes))) }
}

/**
 * Which resource a step competes for. Inference and encoding are limited apart
 * because they are limited by different things: one model at a time is a memory
 * decision, two encodes at a time is a core-count one.
 */
export type WorkbenchLane = 'inference' | 'codec'

export interface WorkbenchLaneLimits { inference: number, codec: number }

export const workbenchLaneLimits: WorkbenchLaneLimits = { inference: 1, codec: 2 }

const lanes: Partial<Record<WorkbenchStep, WorkbenchLane>> = {
  cutout: 'inference',
  layout: 'codec',
  brand: 'codec',
  compress: 'codec',
}

export function workbenchLaneOf(step: WorkbenchStep): WorkbenchLane | undefined {
  return lanes[step]
}

/** One core has to stay for the page itself, and §12.11 never asks for more than two encodes. */
export function resolveWorkbenchLaneLimits(device: { hardwareConcurrency?: number }, base: WorkbenchLaneLimits = workbenchLaneLimits): WorkbenchLaneLimits {
  if (!device.hardwareConcurrency) return { ...base }

  return { ...base, codec: Math.max(1, Math.min(base.codec, device.hardwareConcurrency - 1)) }
}

export interface WorkbenchQueueItem {
  /** Generated here, never derived from the file, so nothing about the source travels with it. */
  id: string
  /** Its place in the batch, and the only thing its visible label is built from. */
  ordinal: number
  bytes: number
  session: WorkbenchSession
}

export interface WorkbenchQueue {
  purpose: WorkbenchPurpose
  /** The one step being read. A batch has many items and one panel. */
  current: WorkbenchStep
  /**
   * The shape every item starts from: which steps this branch has, and which
   * ones this device can run. It exists before the first file does, so an empty
   * batch can still say what its pipeline will and will not include.
   */
  pipeline: WorkbenchSession
  items: WorkbenchQueueItem[]
  limits: WorkbenchQueueLimits
  /** How many items this queue has ever admitted, so a removed one's number is never reused. */
  admitted: number
}

export type WorkbenchAdmissionCode = 'too_many_items' | 'batch_too_large'

export interface WorkbenchAdmission {
  queue: WorkbenchQueue
  accepted: WorkbenchQueueItem[]
  rejected: { index: number, code: WorkbenchAdmissionCode }[]
}

export function createWorkbenchQueue(purpose: WorkbenchPurpose = 'compliant', limits: WorkbenchQueueLimits = workbenchQueueLimits): WorkbenchQueue {
  return { purpose, current: 'import', pipeline: createWorkbenchSession(purpose), items: [], limits, admitted: 0 }
}

export function workbenchQueueBytes(queue: WorkbenchQueue) {
  return queue.items.reduce((total, item) => total + item.bytes, 0)
}

/**
 * Takes in what fits and says why the rest did not, before a single file is
 * decoded. §12.11 wants the ceilings explained up front and the batch made
 * correctable; a candidate that does not fit is therefore refused by name and
 * leaves everything already admitted exactly as it was.
 */
export function admitWorkbenchFiles(queue: WorkbenchQueue, candidates: { bytes: number }[]): WorkbenchAdmission {
  const items = [...queue.items]
  const accepted: WorkbenchQueueItem[] = []
  const rejected: WorkbenchAdmission['rejected'] = []
  let bytes = workbenchQueueBytes(queue)
  let admitted = queue.admitted

  candidates.forEach((candidate, index) => {
    if (items.length >= queue.limits.maxItems) {
      rejected.push({ index, code: 'too_many_items' })
      return
    }
    if (bytes + candidate.bytes > queue.limits.maxBytes) {
      rejected.push({ index, code: 'batch_too_large' })
      return
    }
    admitted += 1
    bytes += candidate.bytes
    const item: WorkbenchQueueItem = {
      id: `item-${admitted}`,
      ordinal: admitted,
      bytes: candidate.bytes,
      session: queue.pipeline,
    }
    items.push(item)
    accepted.push(item)
  })

  return { queue: { ...queue, items, admitted }, accepted, rejected }
}

export function removeWorkbenchItem(queue: WorkbenchQueue, id: string): WorkbenchQueue {
  return { ...queue, items: queue.items.filter(item => item.id !== id) }
}

export function clearWorkbenchQueue(queue: WorkbenchQueue): WorkbenchQueue {
  return { ...queue, items: [], current: 'import' }
}

export function findWorkbenchItem(queue: WorkbenchQueue, id: string) {
  return queue.items.find(item => item.id === id)
}

export function updateWorkbenchItem(queue: WorkbenchQueue, id: string, transition: (session: WorkbenchSession) => WorkbenchSession): WorkbenchQueue {
  return { ...queue, items: queue.items.map(item => item.id === id ? { ...item, session: transition(item.session) } : item) }
}

export function updateWorkbenchItems(queue: WorkbenchQueue, transition: (session: WorkbenchSession) => WorkbenchSession): WorkbenchQueue {
  return { ...queue, items: queue.items.map(item => ({ ...item, session: transition(item.session) })) }
}

/**
 * A change to the pipeline itself — the branch, or what this device can run —
 * applies to the batch and to whatever is admitted next. Anything an item
 * earned on its own goes through `updateWorkbenchItem` instead.
 */
export function updateWorkbenchPipeline(queue: WorkbenchQueue, transition: (session: WorkbenchSession) => WorkbenchSession): WorkbenchQueue {
  return { ...updateWorkbenchItems(queue, transition), pipeline: transition(queue.pipeline) }
}

/**
 * The verdict of reading the picture's own dimensions. A file the shared image
 * limits refuse is settled here, before the batch starts, so nothing fails
 * halfway through a run that was already reported as possible.
 */
export function measureWorkbenchItem(queue: WorkbenchQueue, id: string, size: { width: number, height: number }): WorkbenchQueue {
  return updateWorkbenchItem(queue, id, session => exceedsImageLimits(size.width, size.height)
    ? failWorkbenchStep(session, 'import', 'too_large')
    : completeWorkbenchStep(session, 'import'))
}

export function setWorkbenchQueuePurpose(queue: WorkbenchQueue, purpose: WorkbenchPurpose): WorkbenchQueue {
  if (queue.purpose === purpose) return queue
  const moved = updateWorkbenchPipeline({ ...queue, purpose }, session => setWorkbenchPurpose(session, purpose))

  return goToWorkbenchStep(moved, workbenchStepStatus(moved, queue.current).reachable ? queue.current : 'layout')
}

export interface WorkbenchStepStatus {
  state: WorkbenchStepState
  counts: Record<WorkbenchStepState, number>
  reachable: boolean
}

/**
 * What the step rail says about one step for the whole batch.
 *
 * The precedence answers a question a count cannot: a step with two items ready
 * and one failed is still a step to work on, so it reads as ready, while the
 * counts stay beside it — an aggregate that hid the failure would be worse than
 * no aggregate at all.
 */
export function workbenchStepStatus(queue: WorkbenchQueue, step: WorkbenchStep): WorkbenchStepStatus {
  const counts: Record<WorkbenchStepState, number> = { locked: 0, ready: 0, running: 0, done: 0, skipped: 0, failed: 0, unavailable: 0 }
  for (const item of queue.items) counts[item.session.states[step]] += 1

  const order: WorkbenchStepState[] = ['running', 'ready', 'failed', 'locked', 'done', 'skipped', 'unavailable']
  if (queue.items.length === 0) {
    return { state: queue.pipeline.states[step], counts, reachable: isWorkbenchStepReachable(queue.pipeline, step) }
  }

  return {
    state: order.find(candidate => counts[candidate] > 0) ?? 'locked',
    counts,
    reachable: queue.items.some(item => isWorkbenchStepReachable(item.session, step)),
  }
}

export function goToWorkbenchStep(queue: WorkbenchQueue, step: WorkbenchStep): WorkbenchQueue {
  return workbenchStepStatus(queue, step).reachable ? { ...queue, current: step } : queue
}

/**
 * Moves the reading position on once a step has produced something for the
 * batch. It only moves from the step that just ran, and only when at least one
 * item settled there: a batch where every item failed has nothing to move on
 * to, and a merchant who has already navigated elsewhere is left where they are.
 */
export function advanceWorkbenchQueue(queue: WorkbenchQueue, from: WorkbenchStep): WorkbenchQueue {
  const settled = workbenchStepStatus(queue, from)
  if (queue.current !== from || settled.counts.done + settled.counts.skipped === 0) return queue
  const next = workbenchSteps.slice(workbenchSteps.indexOf(from) + 1).find(step => workbenchStepStatus(queue, step).reachable)

  return next ? goToWorkbenchStep(queue, next) : queue
}

/** Steps this batch has at all, in order, so a rail and a summary count the same things. */
export function applicableWorkbenchQueueSteps(queue: WorkbenchQueue): WorkbenchStep[] {
  return workbenchSteps.filter(step => workbenchStepStatus(queue, step).state !== 'unavailable')
}

export type WorkbenchItemStatus = 'pending' | 'running' | 'failed' | 'done'

export function workbenchItemStatus(session: WorkbenchSession): WorkbenchItemStatus {
  const states = Object.values(session.states)
  if (states.includes('running')) return 'running'
  if (states.includes('failed')) return 'failed'

  return finalWorkbenchArtifact(session) ? 'done' : 'pending'
}

/** The aggregate live summary: per item, never per step, because that is what a merchant counts. */
export function workbenchQueueProgress(queue: WorkbenchQueue) {
  const summary = { total: queue.items.length, done: 0, failed: 0, running: 0, pending: 0 }
  for (const item of queue.items) summary[workbenchItemStatus(item.session)] += 1

  return summary
}

/** Items with a file to download, and which step produced it. */
export function workbenchQueueOutputs(queue: WorkbenchQueue) {
  return queue.items.flatMap((item) => {
    const step = finalWorkbenchArtifact(item.session)

    return step ? [{ id: item.id, ordinal: item.ordinal, step }] : []
  })
}

/**
 * Who may start now: the next items waiting on this step, never more than the
 * lane has room for. Items already running are passed in rather than read off
 * the states, because a run is started before the state it will produce exists.
 */
export function planWorkbenchRuns(queue: WorkbenchQueue, step: WorkbenchStep, options: { running: readonly string[], limit: number }): string[] {
  const slots = options.limit - options.running.length
  if (slots <= 0) return []

  return queue.items
    .filter(item => item.session.states[step] === 'ready' && !options.running.includes(item.id))
    .slice(0, slots)
    .map(item => item.id)
}
