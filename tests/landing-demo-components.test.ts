import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BmiResult from '@/components/BmiResult.vue'
import LandingCategoryBlock from '@/components/LandingCategoryBlock.vue'
import LandingDemoBmi from '@/components/LandingDemoBmi.vue'
import LandingDemoClock from '@/components/LandingDemoClock.vue'
import LandingDemoCutout from '@/components/LandingDemoCutout.vue'
import LandingDemoSignature from '@/components/LandingDemoSignature.vue'
import LandingDemoWheel from '@/components/LandingDemoWheel.vue'
import { getBmiDemo, getPickerDemo } from '@/features/landing/demos'
import { supportedLocales } from '@/features/tools/catalog'
import { formatDeviceTime } from '@/features/tools/device-time/domain/format'
import { defaultHourCycle } from '@/features/tools/device-time/domain/hour-cycle'
import { workbenchJobLabels } from '@/features/tools/product-image-workbench/content'
import { getRandomPickerCopy } from '@/features/tools/random-picker/content'
import { landingGlobals } from './support/nuxt-stubs'

/** Each landing demo is a piece of its tool's own screen (#92), so the two can only change together. */
describe('landing demos show their tools', () => {
  afterEach(() => { vi.useRealTimers() })

  it('shows the BMI calculator\'s own result panel', () => {
    for (const locale of supportedLocales) {
      const demo = mount(LandingDemoBmi, { props: { locale } })
      const tool = mount(BmiResult, { props: { locale, result: getBmiDemo(locale).result } })

      expect(demo.get('.bmi-result').html()).toBe(tool.html())
    }
    expect(mount(LandingDemoBmi, { props: { locale: 'zh-tw' } }).text()).toContain('分級：健康體重（18.5 ≦ BMI < 24）')
    expect(mount(LandingDemoBmi, { props: { locale: 'en' } }).text()).toContain('Category: Healthy weight (18.5 ≦ BMI < 24)')
  })

  it('reads the clock as the device time tool would open on this device', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T07:24:05Z'))
    for (const locale of supportedLocales) {
      const demo = mount(LandingDemoClock, { props: { locale } })
      expect(demo.get('.device-time__clock').text(), '預渲染時不顯示建置機器的時間').toBe('--:--:--')

      await flushPromises()
      const expected = formatDeviceTime({
        instant: Date.now(),
        locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offsetMinutes: -new Date().getTimezoneOffset(),
        showSeconds: true,
        hourCycle: defaultHourCycle(locale),
      })
      expect(expected.ok).toBe(true)
      expect(demo.get('.device-time__clock').text().replace(/\s+/g, '')).toBe(expected.ok ? expected.time.replace(/\s+/g, '') : '')
      expect(demo.findAll('.device-time__zone dt').map(term => term.text())).toEqual(locale === 'en' ? ['Time zone', 'UTC offset'] : ['時區', 'UTC 時差'])
      demo.unmount()
    }
  })

  it('shows the background remover\'s frames and the workbench\'s jobs in their own words', () => {
    const zh = mount(LandingDemoCutout, { props: { locale: 'zh-tw' } })
    expect(zh.findAll('.image-background-remover__frame figcaption').map(caption => caption.text())).toEqual(['原圖', '透明背景結果'])
    expect(zh.find('[data-cutout-frame="after"] .image-background-remover__view--alpha').exists(), '透明結果用工具的格紋背景').toBe(true)

    for (const locale of supportedLocales) {
      const demo = mount(LandingDemoCutout, { props: { locale } })
      expect(demo.findAll('.workbench__jobs .choice-option').map(job => job.text())).toEqual(Object.values(workbenchJobLabels).map(label => label[locale]))
      expect(demo.findAll('.workbench__jobs input:checked')).toHaveLength(3)
      expect(demo.get('.workbench__jobs').attributes(), '示範不接受點擊').toHaveProperty('inert')
    }
  })

  it('rests the picker\'s wheel in its result stage with the drawn name below it', () => {
    for (const locale of supportedLocales) {
      const demo = mount(LandingDemoWheel, { props: { locale } })
      expect(demo.get('.picker-stage__title').text()).toBe(getRandomPickerCopy(locale).resultLabel)
      expect(demo.get('.picker-result__item').text()).toBe(getPickerDemo(locale).winner)
    }
  })

  it('places the signature in the signature tool\'s selection frame', () => {
    const demo = mount(LandingDemoSignature, { props: { locale: 'zh-tw' } })
    expect(demo.find('.pdf-signature__placement.pdf-signature__placement--selected').exists()).toBe(true)
    expect(demo.findAll('.pdf-signature__placement .pdf-signature__handle')).toHaveLength(4)
  })

  it('badges a tool with the tool directory\'s own status badge', () => {
    const block = mount(LandingCategoryBlock, {
      props: {
        locale: 'zh-tw',
        category: {
          id: 'image-commerce',
          name: '圖片與商務素材',
          pitch: '示範',
          tools: [{ slug: 'example-tool', name: '示範工具', tagline: '一句話', status: { kind: 'pro' } }],
        },
      },
      global: landingGlobals(),
    })
    expect(block.get('.nb-tool__name .ui-badge').text()).toBe('PRO')
  })
})
