import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { validateImageInput } from '@/features/images/input'
import { imageInputLimits } from '@/features/images/limits'
import { measureImage } from '@/features/images/measure'

const brandAssetKinds = ['frame', 'logo'] as const

export type WorkbenchBrandAssetKind = typeof brandAssetKinds[number]

/**
 * The frame and the Logo a merchant brought with them.
 *
 * They are local assets, not tool output: one pair is chosen once and applied to
 * the whole batch, they are never written anywhere, and they go away with the
 * page. Both are held the same way — file, preview URL, decoded size — because
 * the composition preview places them with the renderer's own geometry and
 * therefore needs their size, not just something to show.
 */
export function useWorkbenchBrandAssets() {
  const files = { frame: shallowRef<File>(), logo: shallowRef<File>() }
  const urls = { frame: ref(''), logo: ref('') }
  const sizes = { frame: shallowRef<{ width: number, height: number }>(), logo: shallowRef<{ width: number, height: number }>() }
  let mounted = true

  function clearAsset(kind: WorkbenchBrandAssetKind) {
    if (urls[kind].value) URL.revokeObjectURL(urls[kind].value)
    files[kind].value = undefined
    urls[kind].value = ''
    sizes[kind].value = undefined
  }

  /** Resolves the refusal code when the file cannot be used, and nothing when it can. */
  async function chooseAsset(kind: WorkbenchBrandAssetKind, file: File): Promise<string | undefined> {
    const code = await validateImageInput(file) ?? (file.size > imageInputLimits.maxBytes ? 'too_large' : undefined)
    if (!mounted) return
    if (code) return code

    clearAsset(kind)
    files[kind].value = file
    urls[kind].value = measureImage(file, (size) => { if (mounted) sizes[kind].value = size })
  }

  onBeforeUnmount(() => {
    mounted = false
    for (const kind of brandAssetKinds) clearAsset(kind)
  })

  return {
    frame: files.frame,
    frameUrl: urls.frame,
    frameSize: sizes.frame,
    logo: files.logo,
    logoUrl: urls.logo,
    logoSize: sizes.logo,
    chooseAsset,
    clearAsset,
  }
}
