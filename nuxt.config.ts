import tailwindcss from '@tailwindcss/vite'
import { themeBootstrapScript } from './app/features/shell/theme'
import { getPublicToolRoutes } from './app/features/tools/catalog'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['shadcn-nuxt', '@nuxt/eslint'],
  css: ['@fontsource-variable/roboto', '~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
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
      routes: [...getPublicToolRoutes(), '/sitemap.xml'],
    },
  },
  app: {
    head: {
      titleTemplate: '%s · toolsliang',
      meta: [
        { name: 'color-scheme', content: 'light dark' },
        { name: 'theme-color', content: '#f6f3f0' },
      ],
      script: [{ innerHTML: themeBootstrapScript, tagPosition: 'head' }],
    },
  },
})
