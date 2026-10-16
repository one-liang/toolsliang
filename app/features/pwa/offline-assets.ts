import type { LocaleCode, ToolOfflineAsset, ToolOfflineMode } from '../tools/catalog'

export type OfflineAssetPhase = 'unknown' | 'idle' | 'downloading' | 'cached' | 'failed' | 'blocked-offline'

/** Why the last attempt ended, so a corrupted download is not explained as a flaky network. */
export type OfflineAssetFailureReason = 'download' | 'digest-mismatch'

export interface OfflineAssetState {
  phase: OfflineAssetPhase
  receivedBytes: number
  totalBytes: number
  attempts: number
  failureReason?: OfflineAssetFailureReason
}

export type OfflineAssetEvent =
  | { type: 'inspected', cached: boolean }
  | { type: 'requested', online: boolean }
  | { type: 'progress', receivedBytes: number, totalBytes?: number }
  | { type: 'completed' }
  | { type: 'failed', reason?: OfflineAssetFailureReason }
  | { type: 'cancelled' }
  | { type: 'evicted' }

/** A cache entry names one exact version, so an upgraded asset never looks prepared. */
export function offlineAssetKey(asset: Pick<ToolOfflineAsset, 'id' | 'version'>): string {
  return `${asset.id}@${asset.version}`
}

export function initialOfflineAssetState(asset: Pick<ToolOfflineAsset, 'bytes'>): OfflineAssetState {
  return { phase: 'unknown', receivedBytes: 0, totalBytes: asset.bytes, attempts: 0 }
}

/**
 * Partial bytes are dropped on cancel and on failure: a half-written engine is
 * never presented as progress a visitor can resume, and every ending state a
 * visitor can reach — idle, failed, blocked-offline — accepts another attempt.
 */
export function reduceOfflineAsset(state: OfflineAssetState, event: OfflineAssetEvent): OfflineAssetState {
  switch (event.type) {
    case 'inspected':
      // The probe answers the initial question only: by the time it resolves the
      // visitor may already have started, cancelled or been blocked offline.
      if (state.phase !== 'unknown') return state
      return { ...state, phase: event.cached ? 'cached' : 'idle', receivedBytes: event.cached ? state.totalBytes : 0 }

    case 'requested':
      if (state.phase === 'cached' || state.phase === 'downloading') return state
      if (!event.online) return { ...state, phase: 'blocked-offline', receivedBytes: 0, failureReason: undefined }
      return { ...state, phase: 'downloading', receivedBytes: 0, failureReason: undefined }

    case 'progress':
      if (state.phase !== 'downloading') return state
      return {
        ...state,
        receivedBytes: event.receivedBytes,
        totalBytes: event.totalBytes ?? state.totalBytes,
      }

    case 'completed':
      if (state.phase !== 'downloading') return state
      return { ...state, phase: 'cached', receivedBytes: state.totalBytes }

    case 'failed':
      if (state.phase !== 'downloading') return state
      return { ...state, phase: 'failed', receivedBytes: 0, attempts: state.attempts + 1, failureReason: event.reason ?? 'download' }

    case 'cancelled':
      if (state.phase !== 'downloading') return state
      return { ...state, phase: 'idle', receivedBytes: 0 }

    case 'evicted':
      // Only a stored copy can go missing; a download in flight is still the newest answer.
      if (state.phase !== 'cached') return state
      return { ...state, phase: 'idle', receivedBytes: 0 }
  }
}

export function offlineAssetProgress(state: OfflineAssetState): number {
  if (state.phase === 'cached') return 1
  if (!(state.totalBytes > 0)) return 0
  return Math.min(1, Math.max(0, state.receivedBytes / state.totalBytes))
}

export type OfflineReadiness = 'ready' | 'prepared' | 'needs-download' | 'blocked-offline'

export interface OfflineReadinessContext {
  cachedAssetKeys: string[]
  online: boolean
}

export function resolveOfflineReadiness(
  tool: { offlineMode: ToolOfflineMode, offlineAssets?: ToolOfflineAsset[] },
  context: OfflineReadinessContext,
): OfflineReadiness {
  if (tool.offlineMode === 'ready') return 'ready'

  const cached = new Set(context.cachedAssetKeys)
  const missing = (tool.offlineAssets ?? []).filter(asset => !cached.has(offlineAssetKey(asset)))

  if (!missing.length) return 'prepared'
  return context.online ? 'needs-download' : 'blocked-offline'
}

/**
 * A tool with first-use files gets them ready on its own when a visitor starts
 * working, so none of these sentences asks for a download or names one: what a
 * visitor needs to know is when it works offline, not how the files get there.
 */
const READINESS_COPY: Record<OfflineReadiness, Record<LocaleCode, string>> = {
  ready: {
    'zh-tw': '離線可用：首次載入後即可離線使用。',
    en: 'Works offline: available after the first load.',
  },
  prepared: {
    'zh-tw': '離線可用：這台裝置已經準備好，離線也能使用。',
    en: 'Works offline: this device is ready, so the tool keeps working offline.',
  },
  'needs-download': {
    'zh-tw': '用過一次後，離線也能使用。',
    en: 'After you use it once, it works offline too.',
  },
  'blocked-offline': {
    'zh-tw': '目前離線。第一次使用需要連上網路，用過一次後，離線也能使用。',
    en: 'You are offline. The first use needs an internet connection; after you use it once, it works offline too.',
  },
}

export function describeOfflineReadiness(readiness: OfflineReadiness, locale: LocaleCode): string {
  return READINESS_COPY[readiness][locale]
}

export function formatAssetSize(bytes: number, locale: LocaleCode): string {
  const megabytes = bytes / 1_000_000
  const value = megabytes >= 10 ? Math.round(megabytes) : Math.round(megabytes * 10) / 10
  return new Intl.NumberFormat(locale === 'en' ? 'en' : 'zh-TW').format(value) + ' MB'
}
