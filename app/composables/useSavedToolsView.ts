import { computed, onMounted, ref } from 'vue'

/**
 * The saved view is a device-local filter on the prerendered tool directory, so
 * the server renders `/tools/` without knowing the filter is on. Deciding that
 * after hydration keeps the first paint identical to the prerendered markup and
 * lets every entry — desktop sidebar, mobile navigation, and the directory page
 * itself — agree on one path and one active state.
 */
export function useSavedToolsView() {
  const route = useRoute()
  const { withLocale } = useAppLocale()
  const hydrated = ref(false)

  onMounted(() => {
    hydrated.value = true
  })

  return {
    savedViewPath: computed(() => withLocale('/tools/?saved=true')),
    showingSaved: computed(() => hydrated.value && route.query.saved === 'true'),
  }
}
