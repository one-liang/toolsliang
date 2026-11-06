import { encode } from 'uqr'

/**
 * Error correction is fixed at M: about 15% of the code can be dirty or hidden
 * and it still reads. A higher level packs the same text into more, smaller
 * squares, which is harder to scan when printed small, and the four levels mean
 * nothing to the visitor (#131). A logo, if one ever comes, will need H.
 */
export const qrErrorCorrection = 'M' as const

/** The blank margin the standard asks for around a code, in squares. Always drawn, never adjustable. */
export const qrQuietZone = 4

/**
 * The most a code at level M holds, measured on this encoder: 2,331 bytes,
 * which is 2,331 letters or digits typed as text, or 777 Chinese characters at
 * three bytes each. The copy quotes these, and a test holds them to the encoder.
 */
export const qrCapacity = { chineseCharacters: 777, asciiCharacters: 2331 } as const

export interface QrMatrix {
  /** Squares per side, without the quiet zone. */
  size: number
  /** `true` is a dark square. Row by row, top to bottom. */
  modules: boolean[][]
}

export type QrEncoding =
  | { state: 'ready', matrix: QrMatrix }
  | { state: 'too-long' }

export function encodeQr(payload: string): QrEncoding {
  try {
    const result = encode(payload, { ecc: qrErrorCorrection, border: 0, boostEcc: false })
    return { state: 'ready', matrix: { size: result.size, modules: result.data } }
  }
  catch (error) {
    if (error instanceof Error && /too long/i.test(error.message)) return { state: 'too-long' }
    throw error
  }
}
