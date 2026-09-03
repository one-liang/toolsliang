import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['.claude/**', '.codex/**', '.agents/**'],
}, {
  rules: {
    'vue/multi-word-component-names': 'off',
  },
})
