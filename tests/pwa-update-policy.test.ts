import { describe, expect, it } from 'vitest'
import { describeUpdatePrompt, resolveUpdatePrompt, type UpdateSignals } from '@/features/pwa/update-policy'

function signals(patch: Partial<UpdateSignals> = {}): UpdateSignals {
  return {
    hasWaitingWorker: true,
    hasActiveController: true,
    dirtyWorkspaces: [],
    ...patch,
  }
}

describe('PWA update prompt', () => {
  it('stays silent when no new version is waiting', () => {
    expect(resolveUpdatePrompt(signals({ hasWaitingWorker: false }))).toEqual({
      action: 'none', blockedByWork: false,
    })
  })

  it('stays silent on the very first install, when nothing can be disrupted', () => {
    expect(resolveUpdatePrompt(signals({ hasActiveController: false }))).toEqual({
      action: 'none', blockedByWork: false,
    })
  })

  it('notifies rather than reloading when a new version is ready', () => {
    expect(resolveUpdatePrompt(signals())).toEqual({
      action: 'notify', blockedByWork: false,
    })
  })

  it('requires an explicit confirmation while a workspace still holds work', () => {
    expect(resolveUpdatePrompt(signals({ dirtyWorkspaces: ['ntd-uppercase'] }))).toEqual({
      action: 'confirm-before-reload', blockedByWork: true,
    })
  })

  it('never resolves to an automatic reload for any combination of signals', () => {
    for (const hasWaitingWorker of [true, false]) {
      for (const hasActiveController of [true, false]) {
        for (const dirtyWorkspaces of [[], ['ntd-uppercase']]) {
          const prompt = resolveUpdatePrompt({ hasWaitingWorker, hasActiveController, dirtyWorkspaces })
          expect(['none', 'notify', 'confirm-before-reload']).toContain(prompt.action)
        }
      }
    }
  })
})

describe('update prompt copy', () => {
  it('explains the effect of a routine update in both locales', () => {
    const zh = describeUpdatePrompt(resolveUpdatePrompt(signals()), 'zh-tw')
    expect(zh.title).toBe('有新版本可以更新')
    expect(zh.body).toContain('重新載入')
    expect(zh.confirmLabel).toBe('立即更新')
    expect(zh.dismissLabel).toBe('稍後再說')

    const en = describeUpdatePrompt(resolveUpdatePrompt(signals()), 'en')
    expect(en.title).toBe('A new version is ready')
    expect(en.confirmLabel).toBe('Update now')
  })

  it('warns that unfinished work will be lost before a confirmed reload', () => {
    const prompt = resolveUpdatePrompt(signals({ dirtyWorkspaces: ['ntd-uppercase'] }))
    expect(describeUpdatePrompt(prompt, 'zh-tw').body).toContain('尚未完成')
    expect(describeUpdatePrompt(prompt, 'en').body).toContain('unfinished')
  })

})
