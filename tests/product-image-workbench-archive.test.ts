import { describe, expect, it } from 'vitest'
import { workbenchArchiveName, workbenchOutputName } from '@/features/tools/product-image-workbench/archive'

describe('封存檔內的命名', () => {
  it('項目名稱只由工具、序號與格式組成，不含來源檔名', () => {
    expect(workbenchOutputName(1, 'image/jpeg')).toBe('product-image-01.jpg')
    expect(workbenchOutputName(12, 'image/png')).toBe('product-image-12.png')
    expect(workbenchOutputName(3, 'image/webp')).toBe('product-image-03.webp')
  })

  it('封存檔本身也只用工具的名稱', () => {
    expect(workbenchArchiveName).toBe('product-images.zip')
  })
})
