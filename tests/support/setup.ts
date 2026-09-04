import { beforeEach } from 'vitest'
import { installNuxtStubs, resetNuxtStubs } from './nuxt-stubs'

installNuxtStubs()
beforeEach(resetNuxtStubs)
