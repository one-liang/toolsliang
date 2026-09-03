import { describe, expect, it } from 'vitest'
import { publishedTools } from '@/features/tools/catalog'
import { resolveToolWorkspace, validateToolWorkspaces } from '@/features/tools/workspace-resolver'

describe('tool workspace resolver', () => {
  it('resolves every published registration from the allowlisted workspace directory', () => {
    expect(validateToolWorkspaces(publishedTools)).toEqual([])
    expect(resolveToolWorkspace('NtdUppercaseWorkspace')).toBeDefined()
    expect(resolveToolWorkspace('MissingWorkspace')).toBeUndefined()
  })
})
