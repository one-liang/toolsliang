import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['shadcn-nuxt', '@nuxtjs/color-mode', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'toolsliang-theme',
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  app: {
    head: {
      titleTemplate: '%s · toolsliang',
      meta: [
        { name: 'color-scheme', content: 'light dark' },
        { name: 'theme-color', content: '#f3f3f6' },
      ],
    },
  },
})
