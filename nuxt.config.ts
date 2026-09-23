import tailwindcss from '@tailwindcss/vite'
import { join } from 'node:path'
import { buildServiceWorker } from './scripts/build-service-worker.mjs'
import { offlineRoutes, storageRoutes } from './app/features/pwa/cache-policy'
import { manifestPaths } from './app/features/pwa/manifest'
import { themeBootstrapScript } from './app/features/shell/theme'
import { getPublicPageRoutes, getPublicToolRoutes } from './app/features/tools/catalog'

const pagesDemo = process.env.NUXT_PAGES_DEMO === 'true'
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['shadcn-nuxt', '@nuxt/eslint'],
  css: ['@fontsource-variable/roboto', '~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    define: {
      'process.env.NUXT_APP_BASE_URL': JSON.stringify(baseURL),
      'process.env.NUXT_PAGES_DEMO': JSON.stringify(String(pagesDemo)),
    },
    /**
     * Workers are emitted as ES modules so the one that loads its inference
     * runtime at run time can use `import()`. A chunk without imports of its
     * own is still valid classic script, so `createLocalWorker` starts each
     * worker in the mode it actually needs.
     */
    worker: { format: 'es' },
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  nitro: {
    prerender: {
      routes: [
        ...getPublicPageRoutes(),
        ...getPublicToolRoutes(),
        ...offlineRoutes(),
        ...storageRoutes(),
        ...manifestPaths(),
        '/sitemap.xml',
      ],
    },
  },
  hooks: {
    /**
     * Emits `/sw.js` from the same TypeScript cache policy the application and
     * the unit tests use. The build id scopes the shell and static caches, so a
     * deploy can be swept without touching downloaded offline assets.
     */
    'nitro:build:public-assets': async (nitro) => {
      const buildId = nitro.options.runtimeConfig?.app?.buildId ?? 'local'
      await buildServiceWorker(join(nitro.options.output.publicDir, 'sw.js'), buildId)
    },
  },
  app: {
    baseURL,
    head: {
      titleTemplate: '%s · toolsliang',
      meta: [
        ...(pagesDemo ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
        { name: 'color-scheme', content: 'light dark' },
        { name: 'theme-color', content: '#f6f3f0' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'toolsliang' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: `${baseURL}icons/icon-192.png` },
        { rel: 'apple-touch-icon', sizes: '192x192', href: `${baseURL}icons/icon-192.png` },
      ],
      script: [{ innerHTML: themeBootstrapScript, tagPosition: 'head' }],
    },
  },
})
