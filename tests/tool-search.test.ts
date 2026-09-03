import { describe, expect, it } from 'vitest'
import { searchTools } from '@/features/tools/catalog'

describe('tool search', () => {
  it('finds a published tool by curated Chinese keywords and English aliases', () => {
    expect(searchTools('支票', 'zh-tw').map(tool => tool.slug)).toEqual(['ntd-uppercase'])
    expect(searchTools('Taiwan dollar', 'en').map(tool => tool.slug)).toEqual(['ntd-uppercase'])
  })
})
