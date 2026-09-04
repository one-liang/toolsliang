import { describe, expect, it } from 'vitest'
import { describeUpdatePrompt, resolveUpdatePrompt, type UpdateSignals } from '@/features/pwa/update-policy'

function signals(patch: Partial<UpdateSignals> = {}): UpdateSignals {
  return {
    hasWaitingWorker: true,
    hasActiveController: true,
    dirtyWorkspaces: [],
    severity: 'routine',
    ...patch,
  }
}

describe('PWA update prompt', () => {
  it('stays silent when no new version is waiting', () => {
    expect(resolveUpdatePrompt(signals({ hasWaitingWorker: false }))).toEqual({
      action: 'none', tone: 'info', blockedByWork: false,
    })
  })

  it('stays silent on the very first install, when nothing can be disrupted', () => {
    expect(resolveUpdatePrompt(signals({ hasActiveController: false }))).toEqual({
      action: 'none', tone: 'info', blockedByWork: false,
    })
  })

  it('notifies rather than reloading when a new version is ready', () => {
    expect(resolveUpdatePrompt(signals())).toEqual({
      action: 'notify', tone: 'info', blockedByWork: false,
    })
  })

  it('requires an explicit confirmation while a workspace still holds work', () => {
    expect(resolveUpdatePrompt(signals({ dirtyWorkspaces: ['ntd-uppercase'] }))).toEqual({
      action: 'confirm-before-reload', tone: 'info', blockedByWork: true,
    })
  })

  it('raises urgency for a security update without taking the decision away', () => {
    expect(resolveUpdatePrompt(signals({ severity: 'security' }))).toEqual({
      action: 'notify', tone: 'urgent', blockedByWork: false,
    })
    expect(resolveUpdatePrompt(signals({ severity: 'security', dirtyWorkspaces: ['ntd-uppercase'] }))).toEqual({
      action: 'confirm-before-reload', tone: 'urgent', blockedByWork: true,
    })
  })

  it('never resolves to an automatic reload for any combination of signals', () => {
    for (const hasWaitingWorker of [true, false]) {
      for (const hasActiveController of [true, false]) {
        for (const dirtyWorkspaces of [[], ['ntd-uppercase']]) {
          for (const severity of ['routine', 'security'] as const) {
            const prompt = resolveUpdatePrompt({ hasWaitingWorker, hasActiveController, dirtyWorkspaces, severity })
            expect(['none', 'notify', 'confirm-before-reload']).toContain(prompt.action)
          }
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

  it('states that a security update still explains its effect', () => {
    const prompt = resolveUpdatePrompt(signals({ severity: 'security' }))
    expect(describeUpdatePrompt(prompt, 'zh-tw').title).toBe('有安全性更新可以套用')
    expect(describeUpdatePrompt(prompt, 'en').title).toBe('A security update is ready')
  })
})
