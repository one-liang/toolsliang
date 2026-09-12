import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { renderToString } from '@vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import ToolStatusBadge from '@/components/ToolStatusBadge.vue'
import type { ToolStatusMetadata } from '@/features/tools/catalog'

const newStatus: ToolStatusMetadata = { kind: 'new', startsAt: '2026-09-05', endsAt: '2026-10-05' }
const proStatus: ToolStatusMetadata = { kind: 'pro' }
const hotStatus: ToolStatusMetadata = { kind: 'hot', source: 'site-pageviews' }
const INSIDE_WINDOW = '2026-09-15T00:00:00Z'
const AFTER_WINDOW = '2026-10-20T00:00:00Z'
const BEFORE_WINDOW = '2026-08-20T00:00:00Z'

function badge(status: ToolStatusMetadata) {
  return h(ToolStatusBadge, { status, locale: 'zh-tw' as const })
}

function renderServer(status: ToolStatusMetadata, date: string) {
  vi.setSystemTime(new Date(date))
  return renderToString(createSSRApp({ render: () => badge(status) }))
}

/**
 * The mismatch this component guards against only appears when the date that
 * rendered the HTML differs from the date the visitor's device reports, so the
 * two sides are rendered under two different clocks on purpose.
 */
async function hydrateAcrossDates(status: ToolStatusMetadata, buildDate: string, deviceDate: string) {
  const html = await renderServer(status, buildDate)
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)

  vi.setSystemTime(new Date(deviceDate))
  createSSRApp({ render: () => badge(status) }).mount(container)
  await Promise.resolve()

  return container
}

// Only the clock is faked: hydration and `nextTick` still need real microtasks.
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const appDirectory = resolve(process.cwd(), 'app')

function filesEvaluating(symbol: string, directory = appDirectory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return filesEvaluating(symbol, path)
    if (!/\.(ts|vue)$/.test(entry.name)) return []
    return readFileSync(path, 'utf8').includes(`${symbol}(`) ? [relative(appDirectory, path)] : []
  })
}

describe('ToolStatusBadge', () => {
  it('is the only surface that evaluates a status window, so every badge on the site is fixed at once', () => {
    // The label appears on the tool page, the tool directory, saved tools, the
    // landing cards, the sidebar, the category drawer and local search; they
    // are covered by construction only as long as this stays the single caller.
    // Sorted: directory order is the file system's, not something to assert on.
    expect(filesEvaluating('getVisibleStatus').sort()).toEqual([
      'components/ToolStatusBadge.vue',
      'features/tools/catalog.ts',
    ])
  })

  it('keeps the NEW label out of prerendered HTML, because the build date is not the visitor device date', async () => {
    const inside = await renderServer(newStatus, INSIDE_WINDOW)

    expect(inside).not.toContain('NEW')
    expect(await renderServer(newStatus, AFTER_WINDOW)).toBe(inside)
    expect(await renderServer(newStatus, BEFORE_WINDOW)).toBe(inside)
  })

  it('keeps a status that no date can change in the prerendered HTML', async () => {
    expect(await renderServer(proStatus, INSIDE_WINDOW)).toContain('PRO')
    expect(await renderServer(hotStatus, INSIDE_WINDOW)).toContain('熱門')
  })

  it('hydrates a prerendered page without a mismatch on either side of the NEW window', async () => {
    // Vue logs this error once per module instance, so both directions are
    // checked inside one test rather than letting the first one silence the next.
    const errors: string[] = []
    const consoleError = vi.spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => { errors.push(args.map(String).join(' ')) })

    const expired = await hydrateAcrossDates(newStatus, INSIDE_WINDOW, AFTER_WINDOW)
    const revived = await hydrateAcrossDates(newStatus, AFTER_WINDOW, INSIDE_WINDOW)
    consoleError.mockRestore()

    expect(errors.filter(message => message.includes('Hydration'))).toEqual([])
    expect(expired.textContent).not.toContain('NEW')
    expect(revived.textContent).toContain('NEW')
  })

  it('shows the NEW label from the device date once mounted', async () => {
    vi.setSystemTime(new Date(INSIDE_WINDOW))
    const wrapper = mount(ToolStatusBadge, { props: { status: newStatus, locale: 'zh-tw' } })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('NEW')
  })

  it('drops the NEW label once the device date leaves the registered range', async () => {
    vi.setSystemTime(new Date(AFTER_WINDOW))
    const wrapper = mount(ToolStatusBadge, { props: { status: newStatus, locale: 'zh-tw' } })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('NEW')
    expect(wrapper.find('[data-slot="badge"]').exists()).toBe(false)
  })
})
