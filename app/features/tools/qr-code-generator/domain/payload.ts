/**
 * What a visitor fills in, turned into the exact text a QR Code carries. The
 * code is static (#131): the text is the code, so nothing here may depend on a
 * service that has to stay online for a printed code to keep working.
 */

export const qrContentKinds = ['url', 'text', 'wifi'] as const
export type QrContentKind = typeof qrContentKinds[number]

/** Only the two choices a shop actually meets: a password network, or an open one. */
export const wifiSecurities = ['wpa', 'nopass'] as const
export type WifiSecurity = typeof wifiSecurities[number]

export interface WifiFields {
  ssid: string
  password: string
  security: WifiSecurity
}

export interface QrFields {
  url: string
  text: string
  wifi: WifiFields
}

/**
 * Why a code is not ready yet. Each is a field still to fill, never a mistake:
 * a visitor who typed the network name has not done anything wrong by not having
 * typed the password yet.
 */
export type QrPendingReason = 'wifi-ssid' | 'wifi-password'

export type QrPayload =
  | { state: 'empty' }
  | { state: 'pending', reason: QrPendingReason }
  | { state: 'ready', payload: string }

export function emptyQrFields(): QrFields {
  return { url: '', text: '', wifi: { ssid: '', password: '', security: 'wpa' } }
}

export function buildQrPayload(kind: QrContentKind, fields: QrFields): QrPayload {
  switch (kind) {
    case 'url': {
      const url = normalizeQrUrl(fields.url)
      return url ? { state: 'ready', payload: url } : { state: 'empty' }
    }
    case 'text':
      return fields.text.trim() ? { state: 'ready', payload: fields.text } : { state: 'empty' }
    case 'wifi':
      return buildWifiPayload(fields.wifi)
  }
}

/**
 * A phone camera opens a web page only for an address that names its scheme;
 * `toolsliang.com` on its own is read back as plain text. Anything that does not
 * already start with http:// or https:// gets https:// in front, and the
 * workspace shows the address it actually encodes, so the visitor can see it.
 */
export function normalizeQrUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * The Wi-Fi text phone cameras read: `WIFI:T:WPA;S:<name>;P:<password>;;`, or
 * `WIFI:T:nopass;S:<name>;;` for an open network. The name stays as typed
 * (spaces included), because it has to match the network exactly.
 */
export function buildWifiPayload(wifi: WifiFields): QrPayload {
  const needsPassword = wifi.security === 'wpa'
  const hasSsid = wifi.ssid !== ''
  const hasPassword = wifi.password !== ''

  if (!hasSsid && (!needsPassword || !hasPassword)) return { state: 'empty' }
  if (!hasSsid) return { state: 'pending', reason: 'wifi-ssid' }
  if (needsPassword && !hasPassword) return { state: 'pending', reason: 'wifi-password' }

  const ssid = wifiSsidField(wifi.ssid)
  return {
    state: 'ready',
    payload: needsPassword
      ? `WIFI:T:WPA;S:${ssid};P:${escapeWifiField(wifi.password)};;`
      : `WIFI:T:nopass;S:${ssid};;`,
  }
}

/** Backslash, semicolon, comma, double quote and colon each take a backslash. */
export function escapeWifiField(value: string) {
  return value.replace(/[\\;,":]/g, character => `\\${character}`)
}

/**
 * A reader that meets a name made only of hexadecimal digits, such as
 * `CAFE1234`, may take it as the network's raw bytes instead of its name. In
 * double quotes it can only be read as the name. Such a name has nothing to
 * escape, so the quotes are the whole change.
 */
export function wifiSsidField(ssid: string) {
  return /^[0-9a-f]+$/i.test(ssid) ? `"${ssid}"` : escapeWifiField(ssid)
}
