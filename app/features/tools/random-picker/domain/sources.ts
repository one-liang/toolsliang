/**
 * Document boundary for the random picker: which version of the reviewed
 * fairness decisions it follows, and which boundaries the page has to state.
 * Separated from the sampling constants because it changes when a source is
 * re-reviewed, not when a ceiling or a policy changes. The sources themselves
 * stay in the decision record: they explain how the tool is built, so the page
 * cites none of them (#82, #83).
 */

/** Names the reviewed set of fairness decisions the tool follows, by review date. */
export const randomPickerReferenceVersion = 'random-picker-2026-09-05'

/**
 * Every boundary the page has to state in both locales. A local draw has no
 * witness, so the page says what the result can and cannot be used for. Since
 * #83 they are answered in the questions below the workspace, except the one
 * about repeated names, which the workspace shows while it is true of the list.
 */
export const randomPickerCaveatKeys = [
  'equal-probability-scope',
  'no-audit',
  'not-a-lottery',
  'duplicates-share-chances',
  'wheel-is-presentation',
  'local-processing',
] as const

export type RandomPickerCaveatKey = typeof randomPickerCaveatKeys[number]
