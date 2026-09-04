import { copy, publishedTools, supportedLocales, type LocaleCode } from '../tools/catalog'

export interface AppIcon {
  src: string
  sizes: string
  type: 'image/png'
  purpose: 'any' | 'maskable'
}

export interface AppShortcut {
  name: string
  short_name: string
  description: string
  url: string
}

export interface WebAppManifest {
  id: string
  name: string
  short_name: string
  description: string
  lang: string
  dir: 'ltr'
  start_url: string
  scope: string
  display: 'standalone'
  orientation: 'any'
  theme_color: string
  background_color: string
  icons: AppIcon[]
  shortcuts: AppShortcut[]
}

/** Matches the light `--color-background` token the pre-paint theme script applies. */
const THEME_COLOR = '#f6f3f0'

export const appIcons: AppIcon[] = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

const APP_COPY = {
  name: { 'zh-tw': 'toolsliang 萬用工具', en: 'toolsliang utility tools' },
  description: {
    'zh-tw': '台灣優先的萬用工具，檔案、文字與結果都留在你的裝置上處理。',
    en: 'Taiwan-first utility tools that keep your files, text, and results on your device.',
  },
} as const

export function manifestPath(locale: LocaleCode): string {
  return `/${locale}/manifest.webmanifest`
}

export function manifestPaths(): string[] {
  return supportedLocales.map(manifestPath)
}

/**
 * One manifest per locale so an installed icon opens the language the visitor
 * installed. Shortcuts list only tools that run from the App Shell cache — an
 * installed shortcut must never promise a tool that still needs a download.
 */
export function buildWebAppManifest(locale: LocaleCode): WebAppManifest {
  const start = `/${locale}/`

  return {
    id: start,
    name: APP_COPY.name[locale],
    short_name: 'toolsliang',
    description: APP_COPY.description[locale],
    lang: locale === 'en' ? 'en' : 'zh-Hant-TW',
    dir: 'ltr',
    start_url: start,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    icons: appIcons,
    shortcuts: publishedTools
      .filter(tool => tool.offlineMode === 'ready')
      .map(tool => ({
        name: copy(tool.name, locale),
        short_name: copy(tool.name, locale),
        description: copy(tool.description, locale),
        url: `/${locale}/tools/${tool.slug}/`,
      })),
  }
}
