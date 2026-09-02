export type ToolCategory = '圖片' | '文件' | '計算' | '生活'

export interface MockTool {
  slug: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  category: ToolCategory
  accent: 'orange' | 'blue' | 'mint' | 'yellow'
  popular?: boolean
}

export const mockTools: MockTool[] = [
  {
    slug: 'image-compressor',
    name: '圖片壓縮',
    nameEn: 'Image compressor',
    description: '一次縮小多張圖片，畫質與檔案大小都看得見。',
    descriptionEn: 'Shrink images locally with visible quality and size controls.',
    category: '圖片',
    accent: 'orange',
    popular: true,
  },
  {
    slug: 'product-image-workbench',
    name: '商品圖工作台',
    nameEn: 'Product image workbench',
    description: '把去背、排版、壓縮與批次下載串在同一次作業。',
    descriptionEn: 'Combine cutout, layout, compression, and batch download.',
    category: '圖片',
    accent: 'blue',
    popular: true,
  },
  {
    slug: 'pdf-signature',
    name: 'PDF 手寫簽名',
    nameEn: 'PDF handwritten signature',
    description: '在裝置上加入簽名、縮寫與日期，不上傳 PDF。',
    descriptionEn: 'Place signatures and dates without uploading the PDF.',
    category: '文件',
    accent: 'mint',
    popular: true,
  },
  {
    slug: 'new-taiwan-dollar-uppercase',
    name: '新臺幣國字大寫',
    nameEn: 'NTD uppercase converter',
    description: '將數字金額轉為支票與會計常用的國字表示。',
    descriptionEn: 'Convert an amount to the uppercase form used in Taiwan.',
    category: '計算',
    accent: 'yellow',
    popular: true,
  },
  {
    slug: 'taiwan-calendar',
    name: '台灣行事曆',
    nameEn: 'Taiwan calendar',
    description: '同時查看民國、農曆、節氣、放假日與上班日。',
    descriptionEn: 'See ROC dates, lunar dates, holidays, and workdays.',
    category: '生活',
    accent: 'blue',
  },
  {
    slug: 'local-draw',
    name: '本機抽選',
    nameEn: 'Local draw',
    description: '在單一裝置上從候選名單等機率隨機抽取。',
    descriptionEn: 'Draw randomly from a list on this device.',
    category: '生活',
    accent: 'orange',
  },
]

export const categories: Array<{ name: ToolCategory; nameEn: string; hint: string }> = [
  { name: '圖片', nameEn: 'Images', hint: '壓縮、去背、排版' },
  { name: '文件', nameEn: 'Documents', hint: 'PDF、簽名、轉換' },
  { name: '計算', nameEn: 'Calculate', hint: '金額、日期、單位' },
  { name: '生活', nameEn: 'Everyday', hint: '行事曆、時間、抽選' },
]
