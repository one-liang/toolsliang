import type { PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Its aliases carry the words a visitor searches with — QR碼, 二維碼 — even
 * though the tool itself only ever says QR Code (CONTEXT.md): a search term is
 * matched, not spoken.
 *
 * No content review: the tool answers with nothing from an outside source. How
 * a QR Code is drawn is how the tool works, so the page says how it handles the
 * visitor's content instead (see ToolContentSource).
 */
export const qrCodeGeneratorDefinition: PublishedToolDefinition = {
  slug: 'qr-code-generator', category: 'image-commerce', icon: 'qr-code',
  availability: { state: 'published', publishedAt: '2026-11-06' },
  status: { kind: 'new', startsAt: '2026-11-06', endsAt: '2026-12-06' },
  name: { 'zh-tw': 'QR Code 產生器', en: 'QR Code Generator' },
  description: {
    'zh-tw': '把網址、文字或 Wi-Fi 變成 QR Code，可下載 PNG 與 SVG。',
    en: 'Turn a link, text, or Wi-Fi details into a QR Code, as PNG or SVG.',
  },
  aliases: {
    'zh-tw': ['QR碼產生器', 'QR Code 製作', 'QR Code 生成', '二維碼產生器', 'Wi-Fi QR Code', 'WiFi QR Code'],
    en: ['QR code maker', 'QR code creator', 'Wi-Fi QR code generator', 'WiFi QR code'],
  },
  keywords: {
    'zh-tw': ['QR Code', 'QR碼', '二維碼', '網址', 'Wi-Fi', 'WiFi', '菜單', 'LINE'],
    en: ['QR code', 'Wi-Fi', 'link', 'menu', 'print', 'LINE'],
  },
  processingClass: 'instant', routeComponentKey: 'QrCodeGeneratorWorkspace',
  offlineMode: 'ready', capabilities: ['javascript'],
  acceptedInput: {
    'zh-tw': '一個網址、一段文字，或 Wi-Fi 名稱與密碼',
    en: 'A link, some text, or a Wi-Fi network name and password',
  },
  localProcessingStatement: {
    'zh-tw': 'QR Code 在這台裝置上產生，你輸入的網址、文字和 Wi-Fi 密碼不會保存或送出。',
    en: 'The QR Code is made on this device; the link, text or Wi-Fi password you enter is never stored or sent.',
  },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'qr-code-generator',
    title: {
      'zh-tw': 'QR Code 產生器：網址、文字、Wi-Fi 免費產生，下載 PNG 與 SVG',
      en: 'QR Code Generator for Links, Text and Wi-Fi',
    },
    description: {
      'zh-tw': '貼上網址、輸入文字或填好 Wi-Fi 名稱與密碼，馬上產生 QR Code，可改顏色並下載 PNG 或放大不模糊的 SVG。產生的是不會過期的靜態碼，內容只在這台裝置產生，不會送出，離線也能用。',
      en: 'Paste a link, type some text, or fill in a Wi-Fi name and password to get a QR Code at once, recolour it, and download a PNG or an SVG that stays sharp at any size. It is a static code that never expires, made on your device without sending anything, and it works offline.',
    },
    answer: {
      'zh-tw': 'QR Code 產生器把網址、文字或 Wi-Fi 名稱與密碼直接寫進 QR Code 圖案，可下載 PNG 或適合印刷的 SVG。產生的是靜態碼：沒有到期日、不經過轉址，但印出去之後不能改內容。內容只在這台裝置產生，不會送出。',
      en: 'The QR Code Generator writes a link, text, or a Wi-Fi network name and password straight into the QR Code pattern, as a PNG or a print-ready SVG. It is a static code: no expiry and no redirect, but the content cannot be changed once printed. Everything is made on your device and nothing is sent.',
    },
  },
}
