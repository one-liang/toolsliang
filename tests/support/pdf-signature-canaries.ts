import type { ToolContentCanary } from '../e2e/support/privacy-boundary'

/**
 * What must never leave the device while a PDF is being signed: the document and
 * its name, the password that opens it, the signature itself, and the file that
 * comes out. The base64 markers cover the shapes these take if anything were
 * ever encoded into a URL or a request body.
 */
export const pdfSignatureCanaries: ToolContentCanary[] = [
  { label: 'PDF 檔名', value: 'private-pdf-canary.pdf' },
  { label: '加密 PDF 檔名', value: 'private-locked-canary.pdf' },
  { label: '簽名圖片檔名', value: 'private-signature-canary.png' },
  { label: '輸出檔名', value: 'signed.pdf' },
  { label: 'PDF 開啟密碼', value: 'toolsliang-t24' },
  { label: 'PDF 擁有者密碼', value: 'toolsliang-owner' },
  { label: '輸入的簽名文字', value: '簽名測試用字' },
  { label: 'PDF 二進位特徵', value: '%PDF-1.7' },
  { label: 'PDF 內容 Base64', value: 'JVBERi0' },
  { label: 'PNG 內容／簽名 Base64', value: 'iVBORw0KGgo' },
  { label: 'PNG 二進位特徵', value: 'PNG\r\n\n' },
]
