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

/**
 * The product ships as a prerendered static site with no API route, so a
 * same-origin request that can carry a body is always suspicious. Browsers hide
 * binary payloads such as a `sendBeacon` Blob from the inspector, so the method
 * itself has to be the gate rather than the body.
 */
const READ_ONLY_METHODS = ['GET', 'HEAD']
const BODY_CARRYING_PROTOCOLS = ['http:', 'https:']

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
  return toolContent.filter(canary => canary.value).reduce((redacted, canary) => {
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
  const label = redactToolContent(requestLabel(request, url, policy), toolContent)
  const findings: string[] = []

  const sameOrigin = policy.allowedOrigins.includes(comparableOrigin(url))

  if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && !sameOrigin) {
    findings.push(`${label}: 不允許的第三方請求`)
  }
  else if (BODY_CARRYING_PROTOCOLS.includes(url.protocol) && !READ_ONLY_METHODS.includes(request.method.toUpperCase())) {
    findings.push(`${label}: 同源請求只允許 GET 或 HEAD，本站沒有 API route`)
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
