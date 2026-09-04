import { onMounted } from 'vue'
import { getDeviceStorage } from '@/features/shell/device-storage'
import {
  applyThemeClass,
  DEFAULT_THEME,
  nextTheme,
  persistTheme,
  readStoredTheme,
  type ThemeMode,
} from '@/features/shell/theme'

export function useThemeMode() {
  const mode = useState<ThemeMode>('theme-mode', () => DEFAULT_THEME)

  onMounted(() => {
    mode.value = readStoredTheme(getDeviceStorage()) ?? DEFAULT_THEME
    applyThemeClass(document.documentElement, mode.value)
  })

  function setMode(next: ThemeMode) {
    mode.value = next
    applyThemeClass(document.documentElement, next)
    persistTheme(getDeviceStorage(), next)
  }

  return { mode, toggle: () => setMode(nextTheme(mode.value)) }
}
