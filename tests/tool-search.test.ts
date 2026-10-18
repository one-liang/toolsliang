import { describe, expect, it } from 'vitest'
import { searchTools } from '@/features/tools/catalog'

describe('tool search', () => {
  it('finds a published tool by curated Chinese keywords and English aliases', () => {
    expect(searchTools('支票', 'zh-tw').map(tool => tool.slug)).toEqual(['ntd-uppercase'])
    expect(searchTools('Taiwan dollar', 'en').map(tool => tool.slug)).toEqual(['ntd-uppercase'])
  })

  it('sends a year-conversion search to the year converter alone, not the Taiwan Calendar', () => {
    expect(searchTools('民國年對照', 'zh-tw').map(tool => tool.slug)).toEqual(['roc-year-converter'])
    expect(searchTools('ROC year converter', 'en').map(tool => tool.slug)).toEqual(['roc-year-converter'])
    expect(searchTools('民國', 'zh-tw')[0]?.slug, '名稱開頭相符的工具排在前面').toBe('roc-year-converter')
  })

  it('sends a working-day search to the working day calculator, and a holiday lookup still to the Taiwan Calendar', () => {
    expect(searchTools('工作天', 'zh-tw')[0]?.slug).toBe('working-day-calculator')
    expect(searchTools('營業日計算', 'zh-tw').map(tool => tool.slug)).toEqual(['working-day-calculator'])
    expect(searchTools('business day calculator', 'en')[0]?.slug).toBe('working-day-calculator')
    expect(searchTools('放假日查詢', 'zh-tw')[0]?.slug).toBe('taiwan-calendar')
  })
})
