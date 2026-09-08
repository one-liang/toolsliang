import { beforeEach } from 'vitest'
import { installNuxtStubs, resetNuxtStubs } from './nuxt-stubs'

installNuxtStubs()
// A suite that calls `vi.unstubAllGlobals()` would otherwise take the Nuxt
// auto-imports down with its own stubs and break every later test in the file.
beforeEach(() => {
  installNuxtStubs()
  resetNuxtStubs()
})
