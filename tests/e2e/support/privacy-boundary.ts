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

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

function requestLabel(request: ObservedNetworkRequest, url: URL): string {
  const target = LOCAL_HOSTS.has(url.hostname)
    ? url.pathname
    : request.url

  return `${request.method.toUpperCase()} ${target}`
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
): string[] {
  const url = new URL(request.url)
  const label = requestLabel(request, url)
  const findings: string[] = []

  if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && !LOCAL_HOSTS.has(url.hostname)) {
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
