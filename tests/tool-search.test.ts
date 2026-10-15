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
})
