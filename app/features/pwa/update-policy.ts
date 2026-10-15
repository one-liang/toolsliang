import type { LocaleCode } from '../tools/catalog'

export type UpdateAction = 'none' | 'notify' | 'confirm-before-reload'

export interface UpdateSignals {
  hasWaitingWorker: boolean
  /** False on the very first install: there is no running version to disrupt. */
  hasActiveController: boolean
  dirtyWorkspaces: string[]
}

export interface UpdatePrompt {
  action: UpdateAction
  blockedByWork: boolean
}

export interface UpdatePromptCopy {
  title: string
  body: string
  confirmLabel: string
  dismissLabel: string
}

/**
 * Whether a registration holds a new version queued behind a running one.
 * `waiting` alone does not say so: the very first install also passes through
 * `waiting` on its way to `active`, and Firefox hands a page that reloads during
 * that moment the registration in exactly this state. Offering an update then
 * puts a "new version" banner over the page with nothing to replace. Only a
 * waiting worker beside an active one is a new version.
 */
export function hasWaitingVersion(registration: { waiting: unknown, active: unknown }): boolean {
  return Boolean(registration.waiting && registration.active)
}

/**
 * A waiting version is always an offer, never an event. `confirm-before-reload`
 * is the strongest outcome available, so unfinished work in a workspace can only
 * ever be discarded by an explicit choice.
 */
export function resolveUpdatePrompt(signals: UpdateSignals): UpdatePrompt {
  if (!signals.hasWaitingWorker || !signals.hasActiveController) {
    return { action: 'none', blockedByWork: false }
  }

  return signals.dirtyWorkspaces.length
    ? { action: 'confirm-before-reload', blockedByWork: true }
    : { action: 'notify', blockedByWork: false }
}

const PROMPT_COPY = {
  title: {
    'zh-tw': '有新版本可以更新',
    en: 'A new version is ready',
  },
  bodyWhileWorking: {
    'zh-tw': '目前有尚未完成的工作，重新載入會清除這些內容。請先保存需要的結果，再選擇更新。',
    en: 'A workspace still holds unfinished work, and reloading clears it. Save what you need before you update.',
  },
  body: {
    'zh-tw': '重新載入後就會套用新版本；你可以先完成手邊的工作再更新。',
    en: 'Reloading applies the new version. You can finish what you are doing first.',
  },
  confirmLabel: {
    'zh-tw': '立即更新',
    en: 'Update now',
  },
  dismissLabel: {
    'zh-tw': '稍後再說',
    en: 'Not now',
  },
} satisfies Record<string, Record<LocaleCode, string>>

export function describeUpdatePrompt(prompt: UpdatePrompt, locale: LocaleCode): UpdatePromptCopy {
  return {
    title: PROMPT_COPY.title[locale],
    body: prompt.blockedByWork ? PROMPT_COPY.bodyWhileWorking[locale] : PROMPT_COPY.body[locale],
    confirmLabel: PROMPT_COPY.confirmLabel[locale],
    dismissLabel: PROMPT_COPY.dismissLabel[locale],
  }
}
