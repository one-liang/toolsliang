import { createDecisionRecordReader } from './decision-record'

/**
 * ADR-0011 makes a tool slug a stable URL contract, so §12 of the
 * specification and the tool registry cannot each carry their own version of
 * it: whichever drifts, the site ends up with one tool under two identifiers.
 * The document is read at run time through the same reader the decision
 * records use, which is what makes a rename touching only one of the two files
 * fail instead of shipping.
 */
const reader = createDecisionRecordReader('docs/specs/002-product-and-technical-specification.md')

export interface DeclaredToolRoute {
  /** The `12.n Title` heading, so a failure names the section to open. */
  heading: string
  slug: string
  /** Every `/{locale}/tools/…/` path the same bullet writes out. */
  routeSlugs: string[]
}

/**
 * Every tool subsection of §12 that names a concrete slug. A subsection that
 * reserves none — the HEIC scope bullet, for one — declares nothing and is
 * skipped rather than guessed at; an empty result means the section layout
 * changed and throws, because comparing an empty list to the registry would
 * assert nothing.
 */
export function parseDeclaredToolRoutes(): DeclaredToolRoute[] {
  const bulletPattern = /^#### (12\.\d+ .+)$[\s\S]*?^- \*\*Route and slug:\*\* (.+)$/gm

  const declared = [...reader.record.matchAll(bulletPattern)].flatMap(([, heading, bullet]) => {
    const slug = bullet!.match(/stable (?:tool )?slug `([a-z0-9-]+)`/)?.[1]
    if (!slug) return []

    return [{
      heading: heading!,
      slug,
      routeSlugs: [...bullet!.matchAll(/`\/\{locale\}\/tools\/([a-z0-9-]+)\/`/g)].map(([, routeSlug]) => routeSlug!),
    }]
  })

  if (!declared.length) throw new Error('The specification declares no tool slug; the §12 section layout changed')

  return declared
}
