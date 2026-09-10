/**
 * Reads a picture's own dimensions on this device.
 *
 * Every image surface needs the decoded size before it can place, preview or
 * refuse a file, and the browser only offers it by decoding. The object URL is
 * returned rather than revoked here, because the caller is usually showing the
 * very picture that was measured; releasing it is theirs.
 *
 * A picture the browser refuses to decode simply has no measured size. Saying
 * so is the caller's job — an engine reports the failure in its own words when
 * the step runs.
 */
export function measureImage(
  file: File,
  onSize: (size: { width: number, height: number }) => void,
  onFailure: () => void = () => {},
): string {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => onSize({ width: image.naturalWidth, height: image.naturalHeight })
  image.onerror = () => onFailure()
  image.src = url

  return url
}
