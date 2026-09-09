/**
 * Which image formats this browser can actually be asked to write.
 *
 * Every image tool has to answer this the same way, before it offers a format
 * or starts a job: encoder availability varies by browser, and a tool that
 * offers a format it cannot write fails at the last step, after the work. It
 * lives beside the shared input validator for the same reason that does — one
 * answer, so two image tools cannot disagree about the same browser.
 *
 * It runs inside a worker, where `OffscreenCanvas` is the only canvas there is.
 */
export async function detectEncodableFormats<Format extends string>(
  candidates: readonly Format[],
): Promise<{ supported: boolean, formats: Format[] }> {
  const formats: Format[] = []
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
    return { supported: false, formats }
  }

  const canvas = new OffscreenCanvas(1, 1)
  try {
    if (!canvas.getContext('2d')) return { supported: false, formats }
    for (const format of candidates) {
      try { if ((await canvas.convertToBlob({ type: format })).type === format) formats.push(format) }
      catch { /* This encoder is unavailable; the page offers the working formats. */ }
    }

    return { supported: formats.length > 0, formats }
  }
  finally { canvas.width = 0; canvas.height = 0 }
}
