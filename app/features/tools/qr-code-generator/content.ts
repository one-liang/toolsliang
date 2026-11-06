import { qrCapacity } from './domain/encode'
import type { QrColorProblem } from './domain/colors'
import type { QrContentKind, QrPendingReason, WifiSecurity } from './domain/payload'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the QR Code generator says out loud. The limits it quotes come
 * from the encoder's measured capacity, so a number in a sentence cannot drift
 * from what the tool actually accepts.
 */

const chineseLimit = qrCapacity.chineseCharacters.toLocaleString('en-US')
const asciiLimit = qrCapacity.asciiCharacters.toLocaleString('en-US')

const qrCopyEntries = {
  kindLegend: { 'zh-tw': '要放進 QR Code 的內容', en: 'What goes in the QR Code' },
  kindUrl: { 'zh-tw': '網址', en: 'Link' },
  kindText: { 'zh-tw': '文字', en: 'Text' },
  kindWifi: { 'zh-tw': 'Wi-Fi', en: 'Wi-Fi' },
  urlLabel: { 'zh-tw': '貼上網址', en: 'Paste the link' },
  urlHint: {
    'zh-tw': '例如 LINE 官方帳號、Google 地圖或 Google 評論的連結；沒打 https:// 會自動補上。',
    en: 'For example a LINE Official Account, Google Maps or Google review link. https:// is added if you leave it out.',
  },
  encodedUrlLabel: { 'zh-tw': '寫進 QR Code 的網址', en: 'Address in the code' },
  textLabel: { 'zh-tw': '輸入文字', en: 'Type the text' },
  textHint: {
    'zh-tw': '掃描後會直接顯示這段文字，換行會保留。',
    en: 'Scanning shows this text as it is, line breaks included.',
  },
  ssidLabel: { 'zh-tw': '網路名稱', en: 'Network name' },
  ssidHint: {
    'zh-tw': '和手機上看到的 Wi-Fi 名稱完全一樣，大小寫和空格都要相同。',
    en: 'Exactly as phones list it, capitals and spaces included.',
  },
  securityLegend: { 'zh-tw': '加密方式', en: 'Security' },
  securityWpa: { 'zh-tw': '有密碼（WPA/WPA2/WPA3）', en: 'Password (WPA/WPA2/WPA3)' },
  securityNopass: { 'zh-tw': '無密碼', en: 'No password' },
  passwordLabel: { 'zh-tw': '密碼', en: 'Password' },
  passwordHint: {
    'zh-tw': '密碼會顯示出來方便核對，打錯一個字客人就連不上。',
    en: 'Shown so you can check it: one wrong character and guests cannot connect.',
  },
  showPassword: { 'zh-tw': '顯示密碼', en: 'Show password' },
  hidePassword: { 'zh-tw': '隱藏密碼', en: 'Hide password' },
  colorsLegend: { 'zh-tw': '顏色', en: 'Colours' },
  foregroundLabel: { 'zh-tw': '碼的顏色', en: 'Code colour' },
  backgroundLabel: { 'zh-tw': '底色', en: 'Background colour' },
  resetColors: { 'zh-tw': '改回黑碼白底', en: 'Back to black on white' },
  previewLabel: { 'zh-tw': 'QR Code 預覽', en: 'QR Code preview' },
  previewEmpty: {
    'zh-tw': '輸入內容後，這裡會顯示 QR Code。',
    en: 'Enter something and the QR Code appears here.',
  },
  downloadPng: { 'zh-tw': '下載 PNG', en: 'Download PNG' },
  downloadSvg: { 'zh-tw': '下載 SVG', en: 'Download SVG' },
  downloadFailed: {
    'zh-tw': '這個瀏覽器沒辦法產生 PNG，請改下載 SVG。',
    en: 'This browser could not make the PNG. Download the SVG instead.',
  },
  downloadHelp: {
    'zh-tw': 'PNG 適合 LINE、社群和簡報；SVG 放大也不會模糊，適合印刷。',
    en: 'PNG suits LINE, social posts and slides; SVG stays sharp at any size, for print.',
  },
  scanReminder: {
    'zh-tw': '印刷前請先用手機實際掃一次。QR Code 印出去之後就不能改內容，要改只能重新產生再印。',
    en: 'Scan it with a phone before you print. A printed QR Code cannot be changed; a new one has to be made and printed.',
  },
  // DENSO WAVE's recommended notice; the English sentence is theirs word for word.
  trademark: {
    'zh-tw': 'QR Code 是 DENSO WAVE INCORPORATED 的註冊商標。',
    en: 'QR Code is registered trademark of DENSO WAVE INCORPORATED.',
  },
} satisfies Record<string, LocalizedCopy>

export type QrCopyKey = keyof typeof qrCopyEntries
export const qrCopyKeys = Object.keys(qrCopyEntries) as QrCopyKey[]
export const qrCopy: Record<QrCopyKey, LocalizedCopy> = qrCopyEntries

const kindNames: Record<QrContentKind, LocalizedCopy> = {
  url: { 'zh-tw': '網址', en: 'link' },
  text: { 'zh-tw': '文字', en: 'text' },
  wifi: { 'zh-tw': 'Wi-Fi', en: 'Wi-Fi' },
}

const pendingCopy: Record<QrPendingReason, LocalizedCopy> = {
  'wifi-ssid': {
    'zh-tw': '填上網路名稱後就會產生 QR Code。',
    en: 'Add the network name and the QR Code appears.',
  },
  'wifi-password': {
    'zh-tw': '填上密碼後就會產生 QR Code；開放的網路請選「無密碼」。',
    en: 'Add the password and the QR Code appears. For an open network, choose “No password”.',
  },
}

const tooLongCopy: LocalizedCopy = {
  'zh-tw': `內容太長，放不進一個 QR Code：中文最多約 ${chineseLimit} 字，英文和數字最多約 ${asciiLimit} 字。請刪減內容，或改放一個網址。`,
  en: `Too long for one QR Code: about ${chineseLimit} Chinese characters or ${asciiLimit} letters and digits at most. Shorten it, or link to a page instead.`,
}

const colorProblemCopy: Record<QrColorProblem, LocalizedCopy> = {
  inverted: {
    'zh-tw': '碼的顏色要比底色深：淺色碼配深色底，很多手機會掃不到。',
    en: 'The code has to be darker than the background: many phones cannot read a light code on a dark one.',
  },
  'low-contrast': {
    'zh-tw': '兩個顏色太接近，手機可能分辨不出格子。請把碼的顏色調深，或把底色調淺。',
    en: 'The two colours are too close for phones to tell the squares apart. Make the code darker or the background lighter.',
  },
}

const securityNames: Record<WifiSecurity, 'securityWpa' | 'securityNopass'> = {
  wpa: 'securityWpa',
  nopass: 'securityNopass',
}

/** The visible questions, and the only ones the page publishes as structured data. */
export const qrFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': '產生的 QR Code 會過期嗎？', en: 'Does the QR Code expire?' },
    body: {
      'zh-tw': '不會。這裡產生的是靜態 QR Code，內容直接寫在圖案裡，不經過任何轉址服務，所以沒有到期日，也不怕哪家服務關掉。不過如果裡面的網址本身失效，掃到之後一樣打不開。',
      en: 'No. This is a static QR Code: the content is written into the pattern itself and never passes through a redirect service, so there is no expiry date and no service that can shut it off. If the link inside stops working, though, scanning it leads nowhere.',
    },
  },
  {
    heading: { 'zh-tw': '印出去之後可以改內容嗎？', en: 'Can I change the content after printing?' },
    body: {
      'zh-tw': '不行。內容就是圖案本身，要改只能重新產生再印。可以事後改內容的「動態 QR Code」，其實是把網址交給服務商轉址，你的內容和掃描紀錄都會經過對方的伺服器，toolsliang 不提供這種碼。',
      en: 'No. The content is the pattern, so changing it means making and printing a new code. A “dynamic” QR Code that can be edited later works by handing your link to a provider that redirects every scan, so your content and scans pass through their servers; toolsliang does not make that kind.',
    },
  },
  {
    heading: { 'zh-tw': '可以免費拿來商用嗎？', en: 'Can I use it commercially for free?' },
    body: {
      'zh-tw': '可以。QR Code 的發明者 DENSO WAVE 公開表示，照標準使用不需要授權費，商用也一樣。「QR Code」這個名稱本身是 DENSO WAVE 的註冊商標，在文宣上提到這個名稱時，可以附上商標聲明。',
      en: 'Yes. DENSO WAVE, which invented the QR Code, states that using it as standardised needs no licence fee, commercial use included. The name “QR Code” itself is DENSO WAVE’s registered trademark, so printed material that uses the name can carry their trademark notice.',
    },
  },
  {
    heading: { 'zh-tw': 'Wi-Fi QR Code 怎麼用？', en: 'How do guests use a Wi-Fi QR Code?' },
    body: {
      'zh-tw': '客人用手機相機掃描後，手機會詢問要不要加入這個網路，不用自己輸入密碼。如果有人掃了沒反應，還是得手動輸入，所以建議在 QR Code 旁邊另外寫上網路名稱和密碼。',
      en: 'Guests scan it with their phone camera and the phone offers to join the network, no typing needed. If a phone does not react, the details have to be typed in, so it helps to print the network name and password next to the code.',
    },
  },
  {
    heading: { 'zh-tw': '為什麼有些顏色不能用？', en: 'Why can’t I use some colours?' },
    body: {
      'zh-tw': '手機是靠深淺對比找出格子的。兩個顏色太接近，或改成淺色碼配深色底，很多手機會掃不到，所以工具會先擋下來，不讓你下載。碼要比底色深，而且兩者要差得夠多。',
      en: 'Phones find the squares by how light and dark differ. Colours that are too close, or a light code on a dark background, defeat many phones, so the tool stops you before you download. The code has to be darker than the background, and by enough.',
    },
  },
  {
    heading: { 'zh-tw': '我輸入的內容會被送出嗎？', en: 'Is what I enter sent anywhere?' },
    body: {
      'zh-tw': '不會。QR Code 在這台裝置上產生，你輸入的網址、文字和 Wi-Fi 密碼不會被保存，也不會送到 toolsliang 或其他地方；關掉分頁就消失，沒有網路時也能用。',
      en: 'No. The QR Code is made on this device; the link, text or Wi-Fi password you enter is never stored or sent to toolsliang or anywhere else. It is gone when you close the tab, and the tool works without a connection.',
    },
  },
]

const qrContentIssues = validateQrContent()
if (qrContentIssues.length) {
  throw new Error(`Invalid QR Code content:\n${qrContentIssues.join('\n')}`)
}

export function getQrCopy(locale: LocaleCode): Record<QrCopyKey, string> {
  return Object.fromEntries(qrCopyKeys.map(key => [key, qrCopy[key][locale]])) as Record<QrCopyKey, string>
}

export function securityLabel(security: WifiSecurity, locale: LocaleCode) {
  return qrCopy[securityNames[security]][locale]
}

/** A kind's Chinese name set inside a sentence, with the space Taiwanese copy puts around Latin letters. */
function zhKindName(kind: QrContentKind) {
  const name = kindNames[kind]['zh-tw']
  return `${/^[A-Za-z0-9]/.test(name) ? ' ' : ''}${name}${/[A-Za-z0-9]$/.test(name) ? ' ' : ''}`
}

/** What the preview image is, for anyone who cannot see it. */
export function describeQrPreview(kind: QrContentKind, locale: LocaleCode) {
  return locale === 'en'
    ? `QR Code for the ${kindNames[kind].en} you entered`
    : `你輸入的${zhKindName(kind)}的 QR Code`
}

/** The one line the live region reads when the code is ready: short, because it is spoken on every change. */
export function describeQrReady(kind: QrContentKind, locale: LocaleCode) {
  return locale === 'en'
    ? `QR Code for the ${kindNames[kind].en} is ready.`
    : `${zhKindName(kind).trimStart()}的 QR Code 已產生。`
}

export function qrPendingMessage(reason: QrPendingReason, locale: LocaleCode) {
  return pendingCopy[reason][locale]
}

export function qrTooLongMessage(locale: LocaleCode) {
  return tooLongCopy[locale]
}

export function qrColorMessage(problem: QrColorProblem, locale: LocaleCode) {
  return colorProblemCopy[problem][locale]
}

export function validateQrContent() {
  const issues: string[] = []
  const groups: Array<[string, Record<string, LocalizedCopy>]> = [
    ['copy', qrCopy],
    ['kind', kindNames],
    ['pending', pendingCopy],
    ['color', colorProblemCopy],
    ['too-long', { tooLong: tooLongCopy }],
  ]

  for (const [group, entries] of groups) {
    for (const [key, entry] of Object.entries(entries)) {
      if (!hasLocalizedCopy(entry)) issues.push(`[${group}:${key}] requires both locales`)
    }
  }

  const questions = new Set<string>()
  for (const [index, entry] of qrFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) issues.push(`[faq:${index}] requires both locales`)
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
