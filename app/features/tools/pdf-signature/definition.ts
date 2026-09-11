import type { PublishedToolDefinition } from '../catalog'

/**
 * `offlineMode` is `ready`: both engines ship inside the tool's own worker
 * chunk, so the visitor never has to download an engine or a model before
 * signing. The chunk is a build asset like any other, fetched the first time the
 * workspace starts and cached by the Service Worker from then on — which is the
 * offline promise this product actually makes: a tool you have opened keeps
 * working offline. It is not declared in `getToolWorkspaceAssets`, because a
 * worker that bundles dependencies does not get the same hashed name from the
 * client and the server build, so a server-rendered preload would point at a
 * file that does not exist.
 *
 * Every sentence about what the tool is and is not comes from §10 of
 * `docs/research/009-pdf-local-editing-engine-and-safety-boundary.md`, including
 * the two that have to be visible before a visitor places anything.
 */
export const pdfSignatureDefinition: PublishedToolDefinition = {
  slug: 'pdf-signature', category: 'document', icon: 'pen-line',
  availability: { state: 'published', publishedAt: '2026-09-11' },
  status: { kind: 'new', startsAt: '2026-09-11', endsAt: '2026-10-11' },
  name: { 'zh-tw': 'PDF 手寫簽名', en: 'PDF Handwritten Signature' },
  description: {
    'zh-tw': '在裝置上把手寫簽名放到 PDF 頁面並下載新檔。',
    en: 'Place your handwriting on a PDF page and download a new file, on your device.',
  },
  aliases: {
    'zh-tw': ['PDF 簽名', 'PDF 蓋章', '手寫簽名'],
    en: ['sign PDF', 'handwritten signature', 'PDF signature placement'],
  },
  keywords: {
    'zh-tw': ['PDF', '簽名', '手寫', '本機', '下載'],
    en: ['PDF', 'signature', 'handwriting', 'local', 'download'],
  },
  processingClass: 'worker', routeComponentKey: 'PdfSignatureWorkspace', offlineMode: 'ready',
  capabilities: ['javascript', 'web-worker'],
  acceptedInput: {
    'zh-tw': '一份最多 100 頁、50 MiB 的 PDF，可帶開啟密碼；簽名可以手寫、輸入文字或匯入透明背景的 PNG／WebP。',
    en: 'One PDF of up to 100 pages and 50 MiB, with its open password if it has one; the signature can be drawn, typed, or imported as a transparent PNG or WebP.',
  },
  localProcessingStatement: {
    'zh-tw': 'PDF、頁面預覽、簽名筆跡與輸出檔只在這台裝置處理，密碼不會被傳送或保存。',
    en: 'The PDF, its page previews, your signature strokes, and the exported file are handled on this device only, and a password is never sent or stored.',
  },
  pagePresentation: { showHeadingIcon: false, showLocalProcessingStatement: true },
  seo: {
    contentKey: 'pdf-signature',
    title: {
      'zh-tw': 'PDF 手寫簽名：在瀏覽器本機簽名並下載新檔',
      en: 'PDF Handwritten Signature: sign locally in your browser',
    },
    description: {
      'zh-tw': 'PDF 不離開裝置。在瀏覽器本機手寫、輸入或匯入透明簽名，放到任何一頁後下載新檔；密碼保護的檔案也能開啟，密碼只在裝置上使用。這不是憑證式數位簽章。',
      en: 'Keep the PDF on your device. Draw, type, or import a transparent signature in your browser, place it on any page, and download a new file. Password-protected files open too, with the password used only on your device. This is not a certificate-based digital signature.',
    },
    answer: {
      'zh-tw': '選擇 PDF 後，工具在瀏覽器本機解析頁面並畫出預覽，你可以用滑鼠、觸控或鍵盤把手寫簽名放到任何一頁，再下載加上簽名的新檔。這個工具把你的手寫簽名放到 PDF 頁面上，它不是憑證式數位簽章，也不保證任何法律效力。工具不會驗證簽署人身分，也不會留下任何可供第三方查核的紀錄。未加密的檔案以增量更新寫出，沒有簽名的頁面維持原本的位元組。',
      en: 'Choose a PDF and the tool parses its pages and draws previews locally in your browser; place your handwriting on any page with a pointer, touch, or the keyboard, then download the signed copy. This tool places your handwriting onto a PDF page. It is not a certificate-based digital signature, and it guarantees no legal effect. The tool does not check who signed, and it leaves no record a third party could audit. An unencrypted file is written as an incremental update, so the pages you did not sign keep their original bytes.',
    },
  },
  contentReview: {
    reviewedAt: '2026-09-11', sourceEffectiveAt: '2026-09-11',
    sourceEdition: {
      'zh-tw': 'toolsliang PDF 引擎決策紀錄 009 與 ISO 32000-1、pdf.js、@cantoo/pdf-lib 一手來源（2026-09-11 查閱）',
      en: 'toolsliang PDF engine decision record 009, with the ISO 32000-1, pdf.js, and @cantoo/pdf-lib primary sources (accessed September 11, 2026)',
    },
    sources: [
      { title: { 'zh-tw': 'ISO 32000-1 PDF 1.7 規格', en: 'ISO 32000-1, PDF 1.7' }, url: 'https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf' },
      { title: { 'zh-tw': 'pdf.js 程式庫與 Apache-2.0 授權', en: 'pdf.js repository and Apache-2.0 licence' }, url: 'https://github.com/mozilla/pdf.js/blob/master/LICENSE' },
      { title: { 'zh-tw': '@cantoo/pdf-lib 程式庫與 MIT 授權', en: '@cantoo/pdf-lib repository and MIT licence' }, url: 'https://github.com/cantoo-scribe/pdf-lib/blob/master/LICENSE.md' },
    ],
  },
}
