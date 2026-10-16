/**
 * What the workbench's outputs are called.
 *
 * The archive itself is written by the shared image archive
 * (`@/features/images/archive`); the names inside it are decided here. Entry
 * names are built from the output's purpose and the item's position, so
 * nothing about the source travels into the file a merchant shares.
 */
import type { WorkbenchPurpose } from './session'

const outputExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const outputStems: Record<WorkbenchPurpose, string> = {
  compliant: 'compliant-product-image',
  promotional: 'brand-promo-image',
}

/**
 * What one output is called: what it is, and where it sat in the batch. The
 * same name is used for a single download and for the entry inside the archive,
 * because it is the same file either way — and neither carries the name of the
 * picture the merchant imported.
 */
export function workbenchOutputName(purpose: WorkbenchPurpose, ordinal: number, format: string) {
  return `${outputStems[purpose]}-${String(ordinal).padStart(2, '0')}.${outputExtensions[format] ?? 'png'}`
}

export function workbenchArchiveName(purpose: WorkbenchPurpose) {
  return `${outputStems[purpose]}s.zip`
}
