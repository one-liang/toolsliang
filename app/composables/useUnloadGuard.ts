import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

/**
 * Asks the browser to confirm before a tab with unfinished local work is
 * discarded. It exists because nothing here is saved anywhere: a workspace that
 * keeps its results in memory has no draft to come back to, so closing the tab
 * is the one irreversible action a visitor can take by accident.
 *
 * The listener is attached only while there is work to lose, so a visitor who
 * has done nothing is never interrupted. No state is read, written or reported
 * — the guard knows only whether the workspace is dirty.
 */
export function useUnloadGuard(dirty: Ref<boolean>) {
  let attached = false

  function warn(event: BeforeUnloadEvent) {
    event.preventDefault()
    // Older browsers only honour the legacy channel; both are the same prompt.
    event.returnValue = ''
  }

  function sync(value: boolean) {
    if (typeof window === 'undefined' || value === attached) return
    attached = value
    if (value) window.addEventListener('beforeunload', warn)
    else window.removeEventListener('beforeunload', warn)
  }

  onMounted(() => sync(dirty.value))
  watch(dirty, sync)
  onBeforeUnmount(() => sync(false))
}
