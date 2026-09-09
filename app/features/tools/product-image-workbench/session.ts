/**
 * The workbench's own state: which step a merchant is on, which steps this
 * branch even has, and what each of them has produced so far.
 *
 * It holds no pixels, no file, no blob URL and no channel rule — only the shape
 * of the run — so the orchestration above it can be reasoned about, and tested,
 * without an image. That separation is what lets one engine fail without taking
 * the other steps' results with it: a failure is recorded on one step, and the
 * steps before it keep the state they earned.
 *
 * §12.11 asks for a resumable in-tab job graph. This is that graph, reduced to
 * the one shape the first release needs: a line of steps, two of them optional,
 * one of them belonging to only one branch.
 */

export const workbenchSteps = ['import', 'cutout', 'layout', 'brand', 'output'] as const

export type WorkbenchStep = typeof workbenchSteps[number]

/** Steps a merchant may pass without running, because the work is genuinely optional. */
export const optionalWorkbenchSteps: readonly WorkbenchStep[] = ['cutout', 'brand']

/**
 * ADR-0012 keeps the two outputs apart: a compliant main image may carry no
 * frame, Logo or promotional overlay, so the branch decides whether the brand
 * step exists at all rather than whether it is merely discouraged.
 */
export const workbenchPurposes = ['compliant', 'promotional'] as const

export type WorkbenchPurpose = typeof workbenchPurposes[number]

/**
 * `unavailable` is not a failure: it is a step this run does not have, either
 * because the branch excludes it or because this device cannot run its engine.
 * It never blocks the steps after it.
 */
export type WorkbenchStepState = 'locked' | 'ready' | 'running' | 'done' | 'skipped' | 'failed' | 'unavailable'

export type WorkbenchBlockReason = 'purpose' | 'capability'

export interface WorkbenchSession {
  purpose: WorkbenchPurpose
  /** The step being shown. Only a reachable step can become the current one. */
  current: WorkbenchStep
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
    if (state === 'unavailable') continue

    if (open) {
      if (state === 'locked') states[step] = step === 'output' ? 'done' : 'ready'
    }
    else if (state !== 'locked') states[step] = 'locked'

    open = isSettled(states[step]!)
  }
}

function isOpen(states: Record<WorkbenchStep, WorkbenchStepState>, step: WorkbenchStep) {
  return states[step] !== 'locked' && states[step] !== 'unavailable'
}

/**
 * Settles the line, then keeps the shown step on something a merchant can act
 * on: invalidating a step can close the one they were reading, and leaving them
 * on a panel whose input no longer exists is how a stale result gets used.
 */
function next(session: WorkbenchSession, states: Record<WorkbenchStep, WorkbenchStepState>, errors: WorkbenchSession['errors'], current = session.current): WorkbenchSession {
  settle(states)
  const shown = isOpen(states, current)
    ? current
    : [...workbenchSteps].reverse().find(step => isOpen(states, step)) ?? 'import'

  return { ...session, current: shown, states, errors, blocked: { ...session.blocked } }
}

function withoutError(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession['errors'] {
  return Object.fromEntries(Object.entries(session.errors).filter(([key]) => key !== step))
}

/** The step a merchant lands on after `step` settles: the next one this run has. */
function stepAfter(session: WorkbenchSession, step: WorkbenchStep, states: Record<WorkbenchStep, WorkbenchStepState>) {
  return workbenchSteps.slice(workbenchSteps.indexOf(step) + 1).find(candidate => states[candidate] !== 'unavailable') ?? step
}

export function createWorkbenchSession(purpose: WorkbenchPurpose = 'compliant'): WorkbenchSession {
  const session: WorkbenchSession = {
    purpose,
    current: 'import',
    states: { import: 'locked', cutout: 'locked', layout: 'locked', brand: 'locked', output: 'locked' },
    errors: {},
    blocked: {},
  }

  return applyPurpose(session, purpose)
}

/** The brand step exists only on the promotional branch; nothing else depends on the purpose. */
function applyPurpose(session: WorkbenchSession, purpose: WorkbenchPurpose): WorkbenchSession {
  const states = { ...session.states }
  const blocked = { ...session.blocked }

  if (purpose === 'compliant') {
    states.brand = 'unavailable'
    blocked.brand = 'purpose'
  }
  else {
    if (blocked.brand === 'purpose') states.brand = 'locked'
    delete blocked.brand
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
  const errors = withoutError(session, 'layout')
  const rewound = workbenchSteps.indexOf(session.current) > workbenchSteps.indexOf('layout') ? 'layout' : session.current

  return applyPurpose({ ...session, current: rewound, states, errors }, purpose)
}

export function isWorkbenchStepReachable(session: WorkbenchSession, step: WorkbenchStep) {
  const state = session.states[step]

  return state !== 'locked' && state !== 'unavailable'
}

export function goToWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  return isWorkbenchStepReachable(session, step) ? { ...session, current: step } : session
}

export function startWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (!isWorkbenchStepReachable(session, step)) return session
  const states = { ...session.states, [step]: 'running' as const }

  return next(session, states, withoutError(session, step), step)
}

export function completeWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (!isWorkbenchStepReachable(session, step)) return session
  const states = { ...session.states, [step]: 'done' as const }

  return next(session, states, withoutError(session, step), stepAfter(session, step, states))
}

export function failWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep, code: string): WorkbenchSession {
  if (!isWorkbenchStepReachable(session, step)) return session
  const states = { ...session.states, [step]: 'failed' as const }

  return next(session, states, { ...session.errors, [step]: code }, step)
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
  const states = { ...session.states, [step]: 'ready' as const }

  return next(session, states, withoutError(session, step), step)
}

export function skipWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (!optionalWorkbenchSteps.includes(step) || !isWorkbenchStepReachable(session, step)) return session
  const states = { ...session.states, [step]: 'skipped' as const }

  return next(session, states, withoutError(session, step), stepAfter(session, step, states))
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
  const states = { ...session.states, [step]: 'unavailable' as const }
  const blocked = { ...session.blocked, [step]: reason }
  const current = session.current === step ? stepAfter(session, step, states) : session.current

  return { ...next(session, states, withoutError(session, step), current), blocked }
}

export function unblockWorkbenchStep(session: WorkbenchSession, step: WorkbenchStep): WorkbenchSession {
  if (session.states[step] !== 'unavailable') return session
  const states = { ...session.states, [step]: 'locked' as const }
  const blocked = Object.fromEntries(Object.entries(session.blocked).filter(([key]) => key !== step))

  return { ...next(session, states, { ...session.errors }), blocked }
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
export function finalWorkbenchArtifact(session: WorkbenchSession): 'layout' | 'brand' | undefined {
  if (session.states.output !== 'done') return undefined
  if (session.states.brand === 'done') return 'brand'

  return session.states.layout === 'done' ? 'layout' : undefined
}
