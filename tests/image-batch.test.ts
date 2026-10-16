import { describe, expect, it } from 'vitest'
import { admitImageBatch, imageBatchLimits, resolveImageBatchLimits } from '@/features/images/batch'

const mib = 1024 * 1024

describe('圖片批次上限', () => {
  it('上限依裝置能力下修，回報的數字就是使用者看到的數字', () => {
    expect(resolveImageBatchLimits({})).toEqual(imageBatchLimits)
    expect(resolveImageBatchLimits({ deviceMemory: 8 })).toEqual(imageBatchLimits)

    const small = resolveImageBatchLimits({ deviceMemory: 0.5 })
    expect(small.maxBytes).toBeLessThan(imageBatchLimits.maxBytes)
    expect(small.maxItems).toBeLessThan(imageBatchLimits.maxItems)
    expect(small.maxItems).toBeGreaterThan(0)
  })

  it('回傳的是新物件，呼叫端改了也不會動到共用上限', () => {
    const limits = resolveImageBatchLimits({})
    limits.maxItems = 1

    expect(imageBatchLimits.maxItems).toBe(20)
  })

  it('張數放得下的都收下，超過的依序以張數上限退回', () => {
    const admission = admitImageBatch({ count: 18, bytes: 0 }, [{ bytes: mib }, { bytes: mib }, { bytes: mib }], imageBatchLimits)

    expect(admission.accepted).toEqual([0, 1])
    expect(admission.rejected).toEqual([{ index: 2, code: 'too_many_items' }])
  })

  it('放不下的大檔退回，後面較小、放得下的檔案照樣收下', () => {
    const limits = { maxItems: 20, maxBytes: 10 * mib }
    const admission = admitImageBatch({ count: 1, bytes: 6 * mib }, [{ bytes: 5 * mib }, { bytes: 4 * mib }, { bytes: mib }], limits)

    expect(admission.accepted).toEqual([1])
    expect(admission.rejected).toEqual([{ index: 0, code: 'batch_too_large' }, { index: 2, code: 'batch_too_large' }])
  })

  it('剛好等於上限可以收下', () => {
    expect(admitImageBatch({ count: 0, bytes: 0 }, [{ bytes: 200 * mib }], imageBatchLimits).accepted).toEqual([0])
    expect(admitImageBatch({ count: 19, bytes: 0 }, [{ bytes: 1 }], imageBatchLimits).accepted).toEqual([0])
  })
})
