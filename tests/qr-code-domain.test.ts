import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { checkQrColors, contrastRatio, qrDefaultColors, relativeLuminance, type QrColors } from '@/features/tools/qr-code-generator/domain/colors'
import { encodeQr, qrCapacity, qrQuietZone, type QrMatrix } from '@/features/tools/qr-code-generator/domain/encode'
import {
  buildQrPayload,
  emptyQrFields,
  escapeWifiField,
  normalizeQrUrl,
  type QrFields,
  type WifiFields,
} from '@/features/tools/qr-code-generator/domain/payload'
import {
  buildQrSvg,
  qrPathData,
  qrPixelLayout,
  qrPngSize,
  rasterizeQr,
} from '@/features/tools/qr-code-generator/domain/render'

function fields(overrides: Partial<Omit<QrFields, 'wifi'>> & { wifi?: Partial<WifiFields> } = {}): QrFields {
  const empty = emptyQrFields()
  return { ...empty, ...overrides, wifi: { ...empty.wifi, ...overrides.wifi } }
}

function readyPayload(result: ReturnType<typeof buildQrPayload>) {
  if (result.state !== 'ready') throw new Error(`expected a ready payload, got ${result.state}`)
  return result.payload
}

function readyMatrix(payload: string): QrMatrix {
  const encoding = encodeQr(payload)
  if (encoding.state !== 'ready') throw new Error('expected the payload to fit')
  return encoding.matrix
}

/** Reads a code back the way a scanner would: from the very pixels the PNG is made of. */
function decode(matrix: QrMatrix, colors: QrColors = qrDefaultColors, imageSize = 480) {
  const { width, height, pixels } = rasterizeQr(matrix, colors, imageSize)
  return jsQR(pixels, width, height)?.data ?? null
}

describe('QR Code payload', () => {
  it('puts https:// in front of an address that names no scheme, and leaves one that does alone', () => {
    expect(normalizeQrUrl('toolsliang.com')).toBe('https://toolsliang.com')
    expect(normalizeQrUrl('  line.me/R/ti/p/@example  ')).toBe('https://line.me/R/ti/p/@example')
    expect(normalizeQrUrl('https://maps.app.goo.gl/abc')).toBe('https://maps.app.goo.gl/abc')
    expect(normalizeQrUrl('http://example.com')).toBe('http://example.com')
    expect(normalizeQrUrl('HTTPS://EXAMPLE.COM')).toBe('HTTPS://EXAMPLE.COM')
    expect(normalizeQrUrl('   ')).toBe('')
  })

  it('treats an empty field as nothing to encode yet, not as a mistake', () => {
    expect(buildQrPayload('url', fields())).toEqual({ state: 'empty' })
    expect(buildQrPayload('text', fields({ text: ' \n ' }))).toEqual({ state: 'empty' })
    expect(buildQrPayload('wifi', fields())).toEqual({ state: 'empty' })
  })

  it('keeps plain text exactly as typed, line breaks included', () => {
    expect(readyPayload(buildQrPayload('text', fields({ text: '歡迎光臨\n週一公休' })))).toBe('歡迎光臨\n週一公休')
  })

  it('writes a password network in the Wi-Fi form phone cameras read', () => {
    expect(readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: 'Cafe Guest', password: 'latte2026' } }))))
      .toBe('WIFI:T:WPA;S:Cafe Guest;P:latte2026;;')
  })

  it('escapes the characters the Wi-Fi form reserves, in the name and the password', () => {
    expect(escapeWifiField('a\\b;c,d"e:f')).toBe('a\\\\b\\;c\\,d\\"e\\:f')
    expect(readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: '咖啡店;5G', password: 'a\\b' } }))))
      .toBe('WIFI:T:WPA;S:咖啡店\\;5G;P:a\\\\b;;')
  })

  it('quotes a network name made only of hexadecimal digits so it is read as a name', () => {
    expect(readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: 'CAFE1234', password: 'latte2026' } }))))
      .toBe('WIFI:T:WPA;S:"CAFE1234";P:latte2026;;')
    expect(readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: 'Cafe1234!', password: 'latte2026' } }))))
      .toBe('WIFI:T:WPA;S:Cafe1234!;P:latte2026;;')
  })

  it('writes an open network without a password, even if one was typed before switching', () => {
    expect(readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: 'Free WiFi', password: 'left over', security: 'nopass' } }))))
      .toBe('WIFI:T:nopass;S:Free WiFi;;')
  })

  it('waits for the field still missing instead of producing a code that cannot connect', () => {
    expect(buildQrPayload('wifi', fields({ wifi: { ssid: 'Cafe Guest' } }))).toEqual({ state: 'pending', reason: 'wifi-password' })
    expect(buildQrPayload('wifi', fields({ wifi: { password: 'latte2026' } }))).toEqual({ state: 'pending', reason: 'wifi-ssid' })
    expect(buildQrPayload('wifi', fields({ wifi: { password: 'latte2026', security: 'nopass' } }))).toEqual({ state: 'empty' })
  })
})

describe('QR Code encoding', () => {
  it.each([
    ['網址', readyPayload(buildQrPayload('url', fields({ url: 'toolsliang.com/zh-tw/tools/qr-code-generator/?from=flyer' })))],
    ['LINE 官方帳號', readyPayload(buildQrPayload('url', fields({ url: 'https://line.me/R/ti/p/@example' })))],
    ['繁中純文字', '歡迎光臨！週一至週五 09:00–18:00，新臺幣 1,234 元'],
    ['emoji', '🎉 開幕優惠 😀'],
    ['換行', '第一行\n第二行\n第三行'],
    ['Wi-Fi', readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: '咖啡店;5G', password: 'p@ss:w0rd\\;' } })))],
    ['無密碼 Wi-Fi', readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: 'Free WiFi', security: 'nopass' } })))],
    ['十六進位名稱', readyPayload(buildQrPayload('wifi', fields({ wifi: { ssid: 'CAFE1234', password: 'latte2026' } })))],
  ])('%s reads back exactly as encoded', (_name, payload) => {
    expect(decode(readyMatrix(payload))).toBe(payload)
  })

  it('reads back from the full-size PNG in brand colours', () => {
    const payload = 'https://toolsliang.com/zh-tw/'
    const colors = { foreground: '#1f3a5f', background: '#fff8e7' }
    expect(checkQrColors(colors).state).toBe('ok')
    expect(decode(readyMatrix(payload), colors, qrPngSize)).toBe(payload)
  })

  it('holds as much as the copy promises, and says when the text no longer fits', () => {
    expect(encodeQr('測'.repeat(qrCapacity.chineseCharacters)).state).toBe('ready')
    expect(encodeQr('測'.repeat(qrCapacity.chineseCharacters + 1))).toEqual({ state: 'too-long' })
    expect(encodeQr('a'.repeat(qrCapacity.asciiCharacters)).state).toBe('ready')
    expect(encodeQr('a'.repeat(qrCapacity.asciiCharacters + 1))).toEqual({ state: 'too-long' })
  })

  it('uses error correction level M, so the same address keeps its size', () => {
    // Version 3 (29 squares) at M; level H would need version 4 (33 squares) for the same address.
    expect(readyMatrix('https://line.me/R/ti/p/@example').size).toBe(29)
  })
})

describe('QR Code colours', () => {
  it('accepts black on white and any dark code on a light ground with enough contrast', () => {
    expect(checkQrColors(qrDefaultColors)).toMatchObject({ state: 'ok' })
    expect(checkQrColors({ foreground: '#767676', background: '#ffffff' }).state).toBe('ok')
  })

  it('blocks a light code on a dark ground, which many readers miss', () => {
    expect(checkQrColors({ foreground: '#ffffff', background: '#000000' })).toMatchObject({ state: 'blocked', problem: 'inverted' })
  })

  it('blocks a pair that is too close to tell apart', () => {
    expect(checkQrColors({ foreground: '#777777', background: '#ffffff' })).toMatchObject({ state: 'blocked', problem: 'low-contrast' })
    expect(checkQrColors({ foreground: '#336699', background: '#336699' })).toMatchObject({ state: 'blocked', problem: 'low-contrast' })
  })

  it('measures contrast the way the site measures its own text', () => {
    expect(contrastRatio(relativeLuminance('#000000'), relativeLuminance('#ffffff'))).toBe(21)
    expect(() => relativeLuminance('red')).toThrow()
  })
})

describe('QR Code images', () => {
  const tiny: QrMatrix = { size: 3, modules: [[true, true, false], [false, true, true], [false, false, false]] }

  it('draws each run of dark squares as one rectangle inside the quiet zone', () => {
    expect(qrQuietZone).toBe(4)
    expect(qrPathData(tiny)).toBe('M4 4h2v1h-2zM5 5h2v1h-2z')
  })

  it('writes an SVG from squares and checked colours only', () => {
    const svg = buildQrSvg(tiny, { foreground: '#123456', background: '#fedcba' })
    expect(svg).toContain('viewBox="0 0 11 11"')
    expect(svg).toContain('fill="#fedcba"')
    expect(svg).toContain('fill="#123456"')
    expect(() => buildQrSvg(tiny, { foreground: '"/><script>', background: '#ffffff' })).toThrow()
  })

  it('makes a 1024 px PNG with whole-pixel squares and the leftover pixels in the margin', () => {
    const matrix = readyMatrix('https://toolsliang.com/zh-tw/tools/qr-code-generator/')
    const { pixelsPerModule, offset } = qrPixelLayout(matrix)
    expect(Number.isInteger(pixelsPerModule)).toBe(true)
    expect(offset).toBeGreaterThanOrEqual(qrQuietZone * pixelsPerModule)
    expect(offset * 2 + pixelsPerModule * matrix.size).toBeGreaterThan(qrPngSize - 2)

    const { width, height, pixels } = rasterizeQr(matrix, qrDefaultColors)
    expect([width, height]).toEqual([qrPngSize, qrPngSize])
    const at = (x: number, y: number) => pixels[(y * width + x) * 4]
    // The top-left finder square is always dark, and exactly one square wide at its corner.
    expect(at(offset, offset)).toBe(0)
    expect(at(offset + pixelsPerModule - 1, offset + pixelsPerModule - 1)).toBe(0)
    expect(at(offset - 1, offset)).toBe(255)
  })

  it('keeps the quiet zone even for the largest code', () => {
    const matrix = readyMatrix('a'.repeat(qrCapacity.asciiCharacters))
    expect(matrix.size).toBe(177)
    const { pixelsPerModule, offset } = qrPixelLayout(matrix)
    expect(offset).toBeGreaterThanOrEqual(qrQuietZone * pixelsPerModule)
  })
})
