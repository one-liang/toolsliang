import { describe, expect, it } from 'vitest'
import { toolCategories, tools, toolsByCategory } from '@/features/tools/catalog'

describe('tool catalog', () => {
  it('uses unique stable English slugs', () => {
    const slugs = tools.map(tool => tool.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs.every(slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))).toBe(true)
  })

  it('provides bilingual copy and a valid category for every tool', () => {
    const categoryIds = new Set(toolCategories.map(category => category.id))
    for (const tool of tools) {
      expect(tool.name['zh-tw']).toBeTruthy()
      expect(tool.name.en).toBeTruthy()
      expect(tool.description['zh-tw']).toBeTruthy()
      expect(tool.description.en).toBeTruthy()
      expect(categoryIds.has(tool.category)).toBe(true)
    }
  })

  it('lists every tool exactly once through category groups', () => {
    const grouped = toolCategories.flatMap(category => toolsByCategory(category.id))
    expect(grouped).toHaveLength(tools.length)
    expect(new Set(grouped.map(tool => tool.slug)).size).toBe(tools.length)
  })
})
