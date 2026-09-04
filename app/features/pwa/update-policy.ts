import type { LocaleCode } from '../tools/catalog'

export type UpdateSeverity = 'routine' | 'security'
export type UpdateAction = 'none' | 'notify' | 'confirm-before-reload'

export interface UpdateSignals {
  hasWaitingWorker: boolean
  /** False on the very first install: there is no running version to disrupt. */
  hasActiveController: boolean
  dirtyWorkspaces: string[]
  severity: UpdateSeverity
}

export interface UpdatePrompt {
  action: UpdateAction
  tone: 'info' | 'urgent'
  blockedByWork: boolean
}

export interface UpdatePromptCopy {
  title: string
  body: string
  confirmLabel: string
  dismissLabel: string
}

/**
 * A waiting version is always an offer, never an event. `confirm-before-reload`
 * is the strongest outcome available, so unfinished work in a workspace can only
 * ever be discarded by an explicit choice — a security update raises the tone,
 * not the platform's authority over the visitor's work.
 */
export function resolveUpdatePrompt(signals: UpdateSignals): UpdatePrompt {
  const tone = signals.severity === 'security' ? 'urgent' : 'info'

  if (!signals.hasWaitingWorker || !signals.hasActiveController) {
    return { action: 'none', tone: 'info', blockedByWork: false }
  }

  if (signals.dirtyWorkspaces.length) {
    return { action: 'confirm-before-reload', tone, blockedByWork: true }
  }

  return { action: 'notify', tone, blockedByWork: false }
}

export function describeUpdatePrompt(prompt: UpdatePrompt, locale: LocaleCode): UpdatePromptCopy {
  const zh = locale !== 'en'
  const title = prompt.tone === 'urgent'
    ? (zh ? '有安全性更新可以套用' : 'A security update is ready')
    : (zh ? '有新版本可以更新' : 'A new version is ready')

  const body = prompt.blockedByWork
    ? (zh
        ? '目前有尚未完成的工作，重新載入會清除這些內容。請先保存需要的結果，再選擇更新。'
        : 'A workspace still holds unfinished work, and reloading clears it. Save what you need before you update.')
    : (zh
        ? '重新載入後就會套用新版本；你可以先完成手邊的工作再更新。'
        : 'Reloading applies the new version. You can finish what you are doing first.')

  return {
    title,
    body,
    confirmLabel: zh ? '立即更新' : 'Update now',
    dismissLabel: zh ? '稍後再說' : 'Not now',
  }
}
