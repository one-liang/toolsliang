import { describe, expect, it } from 'vitest'
import { publishedTools, unpublishedToolSlugs } from '@/features/tools/catalog'
import { parseDeclaredToolRoutes } from './support/tool-specification'

/**
 * The specification and the registry are one slug contract kept in two files.
 * A slug that exists in only one of them is the drift this gate exists to
 * catch, so both assertions report every offending section rather than the
 * first one.
 */
const declaredRoutes = parseDeclaredToolRoutes()
const registeredSlugs = [...publishedTools.map(tool => tool.slug), ...unpublishedToolSlugs]

describe('specification tool routes', () => {
  it('declares only slugs the tool registry actually carries', () => {
    const unregistered = declaredRoutes.filter(route => !registeredSlugs.includes(route.slug))

    expect(unregistered.map(route => `${route.heading}: ${route.slug}`), 'ADR-0011：slug 是穩定 URL 契約').toEqual([])
  })

  it('writes each documented route under the slug the same bullet declares', () => {
    const mismatched = declaredRoutes.filter(route => route.routeSlugs.some(routeSlug => routeSlug !== route.slug))

    expect(
      mismatched.map(route => `${route.heading}: ${route.routeSlugs.join('、')} ≠ ${route.slug}`),
      '同一條 bullet 的 route 與 stable slug 必須是同一個',
    ).toEqual([])
  })
})
