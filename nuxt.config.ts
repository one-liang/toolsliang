export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css', '~/assets/css/variant-b-minimal.css'],
  components: [{ path: '~/components', pathPrefix: false }],
  app: {
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      title: 'toolsliang UI Prototype',
      meta: [
        {
          name: 'description',
          content: 'toolsliang Landing Page、工具導覽與工作區的拋棄式 UI Prototype。',
        },
        { name: 'color-scheme', content: 'light dark' },
      ],
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
})
