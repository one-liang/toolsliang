/**
 * What the workbench's outputs are called.
 *
 * The archive itself is written by the shared image archive
 * (`@/features/images/archive`); the names inside it are decided here. They are
 * built from what the file is and where it sat in the batch, so nothing about
 * the source travels into the file a merchant shares.
 */
const outputExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * What one output is called. The same name is used for a single download and
 * for the entry inside the archive, because it is the same file either way —
 * and neither carries the name of the picture the merchant imported.
 */
export function workbenchOutputName(ordinal: number, format: string) {
  return `product-image-${String(ordinal).padStart(2, '0')}.${outputExtensions[format] ?? 'png'}`
}

export const workbenchArchiveName = 'product-images.zip'
