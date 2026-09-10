/**
 * One item's own state: which steps this run even has, and what each of them
 * has produced so far.
 *
 * It holds no pixels, no file, no blob URL and no channel rule — only the shape
 * of one item's run — so the queue above it can be reasoned about, and tested,
 * without an image. That separation is what lets one engine fail without taking
 * the other steps' results with it: a failure is recorded on one step, and the
 * steps before it keep the state they earned.
 *
 * §12.11 asks for a resumable in-tab job graph. This is one node of it: a line
 * of steps, three of them optional, two belonging to only one branch. Which
 * step a merchant is reading is not here — a batch has many items and one
 * reading position, and that belongs to the queue.
 */

export const workbenchSteps = ['import', 'cutout', 'layout', 'brand', 'compress', 'output'] as const

export type WorkbenchStep = typeof workbenchSteps[number]

/** Steps a merchant may pass without running, because the work is genuinely optional. */
export const optionalWorkbenchSteps: readonly WorkbenchStep[] = ['cutout', 'brand', 'compress']

/**
 * ADR-0012 keeps the two outputs apart: a compliant main image may carry no
 * frame, Logo or promotional overlay, so the branch decides whether the brand
 * step exists at all rather than whether it is merely discouraged. Compression
 * is split for the same reason from the other side — a channel preset states
 * the capacity a compliant image must land in, and a second pass over that file
 * would talk the tool out of the range it was just asked to hit.
 */
export const workbenchPurposes = ['compliant', 'promotional'] as const

export type WorkbenchPurpose = typeof workbenchPurposes[number]

/** Steps only the promotional branch has. */
const promotionalOnlySteps: readonly WorkbenchStep[] = ['brand', 'compress']

/**
 * `unavailable` is not a failure: it is a step this run does not have, either
 * because the branch excludes it or because this device cannot run its engine.
 * It never blocks the steps after it.
 */
export type WorkbenchStepState = 'locked' | 'ready' | 'running' | 'done' | 'skipped' | 'failed' | 'unavailable'

export type WorkbenchBlockReason = 'purpose' | 'capability'

export interface WorkbenchSession {
  purpose: WorkbenchPurpose
  states: Record<WorkbenchStep, WorkbenchStepState>
  /** The stable engine error code of the last failure, per step. */
  errors: Partial<Record<WorkbenchStep, string>>
  blocked: Partial<Record<WorkbenchStep, WorkbenchBlockReason>>
}

/** A step whose result the next step is allowed to build on. */
function isSettled(state: WorkbenchStepState) {
  return state === 'done' || state === 'skipped'
}

/**
 * Walks the line once and makes the states consistent with each other: every
 * step whose predecessors have all settled is open, and every step that sits
 * behind an unsettled one is locked, because its input no longer exists.
 *
 * `output` is not work — it is the download — so it settles the moment it is
 * reached rather than waiting for an action nobody has to take.
 */
function settle(states: Record<WorkbenchStep, WorkbenchStepState>) {
  let open = true

  for (const step of workbenchSteps) {
    const state = states[step]
    if (state === 'unavailable') {
      // An optional step this run does not have is simply passed over. A
      // required one that cannot run ends the line instead, because nothing
      // after it would have an input — and an output nobody can produce must
      // not present itself as ready.
      if (!optionalWorkbenchSteps.includes(step)) open = false
      continue
    }

    if (open) {
      if (state === 'locked') states[step] = step === 'output' ? 'done' : 'ready'
    }
    else if (state !== 'locked') states[step] = 'locked'

    open = isSettled(states[step]!)
  }
}

function next(session: WorkbenchSession, states: Record<WorkbenchStep, WorkbenchStepState>, errors: WorkbenchSession['errors']): WorkbenchSession {
  settle(states)

  return { ...session, states, errors, blocked: { ...session.blocked } }
}

function withoutError(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession['errors'] {
  return Object.fromEntries(Object.entries(session.errors).filter(([key]) => key !== step))
}

function withoutBlock(blocked: WorkbenchSession['blocked'], step: WorkbenchStep): WorkbenchSession['blocked'] {
  return Object.fromEntries(Object.entries(blocked).filter(([key]) => key !== step))
}

export function createWorkbenchSession(purpose: WorkbenchPurpose = 'compliant'): WorkbenchSession {
  const session: WorkbenchSession = {
    purpose,
    states: { import: 'locked', cutout: 'locked', layout: 'locked', brand: 'locked', compress: 'locked', output: 'locked' },
    errors: {},
    blocked: {},
  }

  return applyPurpose(session, purpose)
}

/** The promotional steps exist only on their own branch; nothing else depends on the purpose. */
function applyPurpose(session: WorkbenchSession, purpose: WorkbenchPurpose): WorkbenchSession {
  const states = { ...session.states }
  let blocked = { ...session.blocked }

  for (const step of promotionalOnlySteps) {
    if (purpose === 'compliant') {
      states[step] = 'unavailable'
      blocked[step] = 'purpose'
    }
    else if (blocked[step] === 'purpose') {
      states[step] = 'locked'
      blocked = withoutBlock(blocked, step)
    }
  }

  settle(states)

  return { ...session, purpose, states, blocked, errors: { ...session.errors } }
}

/**
 * A different purpose is a different output, so everything from the layout on
 * is produced again — but the imported image and the cutout are the merchant's
 * work, not the branch's, and they survive the switch.
 */
export function setWorkbenchPurpose(session: WorkbenchSession, purpose: WorkbenchPurpose): WorkbenchSession {
  if (session.purpose === purpose) return session

  const states = { ...session.states }
  if (states.layout !== 'unavailable') states.layout = 'locked'

  return applyPurpose({ ...session, states, errors: withoutError(session, 'layout') }, purpose)
}

export function isWorkbenchStepReachable(session: WorkbenchSession, step: WorkbenchStep) {
  const state = session.states[step]

  return state !== 'locked' && state !== 'unavailable'
}

export function startWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (!isWorkbenchStepReachable(session, step)) return session

  return next(session, { ...session.states, [step]: 'running' }, withoutError(session, step))
}

export function completeWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (!isWorkbenchStepReachable(session, step)) return session

  return next(session, { ...session.states, [step]: 'done' }, withoutError(session, step))
}

export function failWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep, code: string): WorkbenchSession {
  if (!isWorkbenchStepReachable(session, step)) return session

  return next(session, { ...session.states, [step]: 'failed' }, { ...session.errors, [step]: code })
}

/**
 * Hands the step back to the merchant with no result and no error to dismiss.
 *
 * It is the same transition whether they cancelled the run or changed one of
 * its settings: in both cases the step has to be run again, and whatever the
 * old result fed has to stop being downloadable. Keeping it one function is
 * what stops the two paths from drifting into different guarantees.
 */
export function resetWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (!isWorkbenchStepReachable(session, step)) return session

  return next(session, { ...session.states, [step]: 'ready' }, withoutError(session, step))
}

export function skipWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (!optionalWorkbenchSteps.includes(step) || !isWorkbenchStepReachable(session, step)) return session

  return next(session, { ...session.states, [step]: 'skipped' }, withoutError(session, step))
}

/**
 * Records why an attempt was refused without touching what the step already
 * produced. A rejected file is the case that matters: the merchant is told the
 * new file cannot be used, and the image they imported before is still there.
 */
export function noteWorkbenchStepError(session: WorkbenchSession, step: WorkbenchStep, code: string): WorkbenchSession {
  return { ...session, errors: { ...session.errors, [step]: code } }
}

export function blockWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep, reason: WorkbenchBlockReason): WorkbenchSession {
  if (session.states[step] === 'unavailable') return session
  const blocked = { ...session.blocked, [step]: reason }

  return { ...next(session, { ...session.states, [step]: 'unavailable' }, withoutError(session, step)), blocked }
}

export function unblockWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (session.states[step] !== 'unavailable') return session
  return { ...next(session, { ...session.states, [step]: 'locked' }, { ...session.errors }), blocked: withoutBlock(session.blocked, step) }
}

/** Steps this run actually has, so progress never counts work nobody was offered. */
export function applicableWorkbenchSteps(session: WorkbenchSession): WorkbenchStep[] {
  return workbenchSteps.filter(step => session.states[step] !== 'unavailable')
}

export function workbenchProgress(session: WorkbenchSession) {
  const applicable = applicableWorkbenchSteps(session)

  return { completed: applicable.filter(step => isSettled(session.states[step]!)).length, total: applicable.length }
}

/**
 * Which step's result is the file a merchant downloads. It is deliberately read
 * off the states rather than remembered: a step that was re-run, cancelled or
 * failed has already invalidated everything after it, so there is no way for a
 * stale result to be offered as the finished one.
 */
export function finalWorkbenchArtifact(session: WorkbenchSession): 'layout' | 'brand' | 'compress' | undefined {
  if (session.states.output !== 'done') return undefined

  return (['compress', 'brand', 'layout'] as const).find(step => session.states[step] === 'done')
}
