export type LocaleCode = 'zh-tw' | 'en'
export type ToolStatus = 'new' | 'pro' | 'hot' | 'saved'
export type ToolIcon = 'banknote' | 'file-text' | 'image' | 'crop' | 'braces' | 'table' | 'type' | 'case-sensitive'

export interface LocalizedCopy {
  'zh-tw': string
  en: string
}

export interface ToolDefinition {
  slug: string
  category: string
  icon: ToolIcon
  name: LocalizedCopy
  description: LocalizedCopy
  status?: ToolStatus
}

export interface ToolCategory {
  id: string
  icon: ToolIcon
  name: LocalizedCopy
  description: LocalizedCopy
}

export const toolCategories: ToolCategory[] = [
  {
    id: 'document', icon: 'file-text',
    name: { 'zh-tw': '文件與金額', en: 'Documents & amounts' },
    description: { 'zh-tw': '整理日常文件內容與台灣常用格式。', en: 'Format everyday documents and Taiwan-specific content.' },
  },
  {
    id: 'image', icon: 'image',
    name: { 'zh-tw': '圖片處理', en: 'Image tools' },
    description: { 'zh-tw': '在瀏覽器內完成尺寸與格式調整。', en: 'Resize and prepare images directly in your browser.' },
  },
  {
    id: 'data', icon: 'braces',
    name: { 'zh-tw': '資料整理', en: 'Data helpers' },
    description: { 'zh-tw': '清理、轉換並檢查結構化資料。', en: 'Clean, transform, and inspect structured data.' },
  },
  {
    id: 'text', icon: 'type',
    name: { 'zh-tw': '文字工具', en: 'Text tools' },
    description: { 'zh-tw': '快速處理字數、大小寫與常用文字格式。', en: 'Handle counts, casing, and common text formats.' },
  },
]

export const tools: ToolDefinition[] = [
  {
    slug: 'ntd-uppercase', category: 'document', icon: 'banknote', status: 'new',
    name: { 'zh-tw': '新台幣大寫轉換', en: 'NTD uppercase converter' },
    description: { 'zh-tw': '將金額轉為收據與合約常用的中文大寫。', en: 'Convert amounts to formal Chinese wording for receipts and contracts.' },
  },
  {
    slug: 'document-counter', category: 'document', icon: 'file-text',
    name: { 'zh-tw': '文件字數統計', en: 'Document counter' },
    description: { 'zh-tw': '計算中文字、英文單字、段落與閱讀時間。', en: 'Count characters, words, paragraphs, and reading time.' },
  },
  {
    slug: 'image-resizer', category: 'image', icon: 'image', status: 'hot',
    name: { 'zh-tw': '圖片尺寸調整', en: 'Image resizer' },
    description: { 'zh-tw': '批次調整圖片尺寸，內容不離開裝置。', en: 'Resize image batches without files leaving your device.' },
  },
  {
    slug: 'image-cropper', category: 'image', icon: 'crop', status: 'pro',
    name: { 'zh-tw': '圖片裁切', en: 'Image cropper' },
    description: { 'zh-tw': '依社群、證件與自訂比例快速裁切。', en: 'Crop for social, ID, and custom aspect ratios.' },
  },
  {
    slug: 'json-formatter', category: 'data', icon: 'braces', status: 'saved',
    name: { 'zh-tw': 'JSON 格式化', en: 'JSON formatter' },
    description: { 'zh-tw': '格式化、壓縮並找出 JSON 語法問題。', en: 'Format, minify, and locate JSON syntax issues.' },
  },
  {
    slug: 'csv-viewer', category: 'data', icon: 'table',
    name: { 'zh-tw': 'CSV 檢視器', en: 'CSV viewer' },
    description: { 'zh-tw': '在本機快速預覽欄位與資料列。', en: 'Preview columns and rows locally.' },
  },
  {
    slug: 'text-counter', category: 'text', icon: 'type', status: 'new',
    name: { 'zh-tw': '文字計數器', en: 'Text counter' },
    description: { 'zh-tw': '即時計算字元、行數與去除空白後長度。', en: 'Count characters, lines, and trimmed length instantly.' },
  },
  {
    slug: 'case-converter', category: 'text', icon: 'case-sensitive',
    name: { 'zh-tw': '英文大小寫轉換', en: 'Case converter' },
    description: { 'zh-tw': '轉換標題、句首、camelCase 與 kebab-case。', en: 'Convert title, sentence, camel, and kebab case.' },
  },
]

export function copy<T extends LocalizedCopy>(value: T, locale: LocaleCode) {
  return value[locale]
}

export function getCategory(id: string) {
  return toolCategories.find(category => category.id === id)
}

export function getTool(slug: string) {
  return tools.find(tool => tool.slug === slug)
}

export function toolsByCategory(categoryId: string) {
  return tools.filter(tool => tool.category === categoryId)
}
