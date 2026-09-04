import type { LocaleCode, ToolOfflineAsset, ToolOfflineMode } from '../tools/catalog'

export type OfflineAssetPhase = 'unknown' | 'idle' | 'downloading' | 'cached' | 'failed' | 'blocked-offline'

export interface OfflineAssetState {
  phase: OfflineAssetPhase
  receivedBytes: number
  totalBytes: number
  attempts: number
}

export type OfflineAssetEvent =
  | { type: 'inspected', cached: boolean }
  | { type: 'requested', online: boolean }
  | { type: 'progress', receivedBytes: number, totalBytes?: number }
  | { type: 'completed' }
  | { type: 'failed' }
  | { type: 'cancelled' }

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
      if (!event.online) return { ...state, phase: 'blocked-offline', receivedBytes: 0 }
      return { ...state, phase: 'downloading', receivedBytes: 0 }

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
      return { ...state, phase: 'failed', receivedBytes: 0, attempts: state.attempts + 1 }

    case 'cancelled':
      if (state.phase !== 'downloading') return state
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
  cachedAssetIds: string[]
  online: boolean
}

export function resolveOfflineReadiness(
  tool: { offlineMode: ToolOfflineMode, offlineAssets?: ToolOfflineAsset[] },
  context: OfflineReadinessContext,
): OfflineReadiness {
  if (tool.offlineMode === 'ready') return 'ready'

  const cached = new Set(context.cachedAssetIds)
  const missing = (tool.offlineAssets ?? []).filter(asset => !cached.has(offlineAssetKey(asset)))

  if (!missing.length) return 'prepared'
  return context.online ? 'needs-download' : 'blocked-offline'
}

const READINESS_COPY: Record<OfflineReadiness, Record<LocaleCode, string>> = {
  ready: {
    'zh-tw': '離線可用：首次載入後即可離線使用。',
    en: 'Works offline: available after the first load.',
  },
  prepared: {
    'zh-tw': '已下載所需資源，可離線使用。',
    en: 'The required resources are downloaded, so this tool works offline.',
  },
  'needs-download': {
    'zh-tw': '首次使用需下載所需資源，下載後即可離線使用。',
    en: 'First use downloads the required resources; after that the tool works offline.',
  },
  'blocked-offline': {
    'zh-tw': '目前離線，需連線下載所需資源後才能使用。',
    en: 'You are offline. Go back online to download the required resources first.',
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
