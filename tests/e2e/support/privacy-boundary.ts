export interface ObservedNetworkRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

export interface ToolContentCanary {
  label: string
  value: string
}

export interface NetworkBoundaryPolicy {
  allowedOrigins: readonly string[]
}

function comparableOrigin(url: URL): string {
  if (url.protocol === 'ws:') return `http://${url.host}`
  if (url.protocol === 'wss:') return `https://${url.host}`
  return url.origin
}

function requestLabel(request: ObservedNetworkRequest, url: URL, policy: NetworkBoundaryPolicy): string {
  const target = policy.allowedOrigins.includes(comparableOrigin(url))
    ? url.pathname
    : url.origin

  return `${request.method.toUpperCase()} ${target}`
}

export function redactToolContent(
  value: string,
  toolContent: readonly ToolContentCanary[],
): string {
  return toolContent.reduce((redacted, canary) => {
    const replacement = `[工具內容：${canary.label}]`
    return redacted
      .replaceAll(canary.value, replacement)
      .replaceAll(encodeURIComponent(canary.value), replacement)
  }, value)
}

function containsToolContent(value: string, marker: string): boolean {
  if (value.includes(marker) || value.includes(encodeURIComponent(marker))) {
    return true
  }

  try {
    return decodeURIComponent(value).includes(marker)
  }
  catch {
    // Malformed percent encoding is still inspected in its original form.
    return false
  }
}

export function inspectNetworkRequest(
  request: ObservedNetworkRequest,
  toolContent: readonly ToolContentCanary[],
  policy: NetworkBoundaryPolicy,
): string[] {
  const url = new URL(request.url)
  const label = requestLabel(request, url, policy)
  const findings: string[] = []

  if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && !policy.allowedOrigins.includes(comparableOrigin(url))) {
    findings.push(`${label}: 不允許的第三方請求`)
  }

  const surfaces = [
    ['URL', request.url],
    ['header', Object.entries(request.headers).map(([name, value]) => `${name}:${value}`).join('\n')],
    ['body', request.body ?? ''],
  ] as const

  for (const [surface, value] of surfaces) {
    for (const canary of toolContent.filter(item => item.value)) {
      if (containsToolContent(value, canary.value)) {
        findings.push(`${label}: ${surface} 含有工具內容（${canary.label}）`)
      }
    }
  }

  return findings
}

export function inspectWebSocketFrame(
  socketUrl: string,
  payload: string | Uint8Array,
  toolContent: readonly ToolContentCanary[],
  policy: NetworkBoundaryPolicy,
): string[] {
  return inspectNetworkRequest({
    url: socketUrl,
    method: 'WEBSOCKET FRAME',
    headers: {},
    body: typeof payload === 'string' ? payload : new TextDecoder().decode(payload),
  }, toolContent, policy)
}
