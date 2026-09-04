import { onMounted } from 'vue'
import {
  applyThemeClass,
  DEFAULT_THEME,
  getThemeStorage,
  nextTheme,
  persistTheme,
  readStoredTheme,
  type ThemeMode,
} from '@/features/shell/theme'

export function useThemeMode() {
  const mode = useState<ThemeMode>('theme-mode', () => DEFAULT_THEME)

  onMounted(() => {
    mode.value = readStoredTheme(getThemeStorage()) ?? DEFAULT_THEME
    applyThemeClass(document.documentElement, mode.value)
  })

  function setMode(next: ThemeMode) {
    mode.value = next
    applyThemeClass(document.documentElement, next)
    persistTheme(getThemeStorage(), next)
  }

  return { mode, toggle: () => setMode(nextTheme(mode.value)) }
}
