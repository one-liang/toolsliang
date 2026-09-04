import { computed, onMounted } from 'vue'
import { describeUpdatePrompt, resolveUpdatePrompt, type UpdateSeverity } from '@/features/pwa/update-policy'
import { useDirtyWorkspaces } from '@/composables/useWorkspaceDirty'

const SERVICE_WORKER_URL = '/sw.js'
const APPLY_UPDATE_MESSAGE = { type: 'toolsliang:apply-update' }

/**
 * Registers the Service Worker and turns a waiting version into an offer.
 * Nothing here reloads on its own: `applyUpdate` runs only from an explicit
 * action, so unfinished work is never discarded by a deploy.
 */
export function usePwaUpdate() {
  const { locale } = useAppLocale()
  const { dirtyWorkspaces } = useDirtyWorkspaces()
  const hasWaitingWorker = useState('pwa-waiting-worker', () => false)
  const hasActiveController = useState('pwa-active-controller', () => false)
  const severity = useState<UpdateSeverity>('pwa-update-severity', () => 'routine')
  const dismissed = useState('pwa-update-dismissed', () => false)
  const registered = useState('pwa-registered', () => false)
  let applying = false
  let reloading = false

  const prompt = computed(() => resolveUpdatePrompt({
    hasWaitingWorker: hasWaitingWorker.value,
    hasActiveController: hasActiveController.value,
    dirtyWorkspaces: dirtyWorkspaces.value,
    severity: severity.value,
  }))
  const copy = computed(() => describeUpdatePrompt(prompt.value, locale.value))
  const visible = computed(() => prompt.value.action !== 'none' && !dismissed.value)

  function syncController() {
    hasActiveController.value = Boolean(navigator.serviceWorker.controller)
  }

  async function register() {
    // The worker is emitted by the production build, so `nuxt dev` stays uncached.
    if (registered.value || import.meta.dev || !import.meta.client) return
    if (!('serviceWorker' in navigator)) return
    registered.value = true

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      syncController()
      // The first worker claims the page on its own; only an accepted update reloads it.
      if (!applying || reloading) return
      reloading = true
      window.location.reload()
    })

    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' })
      syncController()
      if (registration.waiting) hasWaitingWorker.value = true

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          syncController()
          if (installing.state !== 'installed' || !navigator.serviceWorker.controller) return
          hasWaitingWorker.value = true
          dismissed.value = false
        })
      })
    }
    catch {
      // An unavailable Service Worker only costs offline support; the tools keep working.
      registered.value = false
    }
  }

  async function applyUpdate() {
    applying = true
    dismissed.value = true
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration?.waiting) registration.waiting.postMessage(APPLY_UPDATE_MESSAGE)
    else window.location.reload()
  }

  function dismiss() {
    dismissed.value = true
  }

  // Registration waits for the page to finish loading: precaching the App Shell
  // must never compete with the requests the current page still needs.
  onMounted(() => {
    if (document.readyState === 'complete') void register()
    else window.addEventListener('load', () => void register(), { once: true })
  })

  return { applyUpdate, copy, dismiss, prompt, visible }
}
