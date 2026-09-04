import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * Workspaces report unfinished work here so a waiting application update can
 * ask before it discards it. Only the workspace key is recorded — never the
 * tool content that makes the workspace dirty.
 */
export function useDirtyWorkspaces() {
  const dirtyWorkspaces = useState<string[]>('pwa-dirty-workspaces', () => [])

  function setWorkspaceDirty(key: string, dirty: boolean) {
    const present = dirtyWorkspaces.value.includes(key)
    if (dirty === present) return
    dirtyWorkspaces.value = dirty
      ? [...dirtyWorkspaces.value, key]
      : dirtyWorkspaces.value.filter(entry => entry !== key)
  }

  return { dirtyWorkspaces, setWorkspaceDirty }
}

/** Binds one workspace's dirty state for as long as its component is mounted. */
export function useWorkspaceDirty(key: string, dirty: Ref<boolean>) {
  const { setWorkspaceDirty } = useDirtyWorkspaces()

  watch(dirty, value => setWorkspaceDirty(key, value), { immediate: true })
  onBeforeUnmount(() => setWorkspaceDirty(key, false))
}
