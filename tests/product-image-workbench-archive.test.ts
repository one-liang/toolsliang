import { describe, expect, it } from 'vitest'
import {
  workbenchOutputName,
  workbenchArchiveName,
} from '@/features/tools/product-image-workbench/archive'

describe('封存檔內的命名', () => {
  it('項目名稱只由用途、序號與格式組成，不含來源檔名', () => {
    expect(workbenchOutputName('compliant', 1, 'image/jpeg')).toBe('compliant-product-image-01.jpg')
    expect(workbenchOutputName('promotional', 12, 'image/png')).toBe('brand-promo-image-12.png')
    expect(workbenchOutputName('promotional', 3, 'image/webp')).toBe('brand-promo-image-03.webp')
  })

  it('封存檔本身也依用途命名', () => {
    expect(workbenchArchiveName('compliant')).toBe('compliant-product-images.zip')
    expect(workbenchArchiveName('promotional')).toBe('brand-promo-images.zip')
  })
})
