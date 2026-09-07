/**
 * What T18 decided about running background removal on the user's own device.
 *
 * The evaluation record `docs/research/007-image-background-removal-model-evaluation.md`
 * is the source; this module is the part T19 can import. It carries provenance,
 * measured budgets, the capability ladder and the failure vocabulary — never a
 * model file, and never anything derived from a user's image.
 */

/** Names the reviewed candidate set by the day the measurements were taken. */
export const backgroundRemovalReferenceVersion = 'image-background-remover-2026-09-07'

/** The inference runtime every measurement ran on. MIT, redistributable. */
export const backgroundRemovalRuntime = {
  id: 'onnxruntime-web',
  version: '1.29.0',
  licence: 'MIT',
  source: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/',
} as const

/**
 * Licences this project may redistribute from its own static assets. A model is
 * only ever selectable when its publisher and its upstream repository agree on
 * one of these; a single ambiguous claim is enough to exclude a family.
 */
export const backgroundRemovalPermittedLicences = ['MIT', 'Apache-2.0'] as const

/** Whether a family is trained for any salient object or only for people. */
export const backgroundRemovalScopes = ['general', 'portrait'] as const

export type BackgroundRemovalScope = typeof backgroundRemovalScopes[number]

export interface BackgroundRemovalCandidate {
  id: string
  family: string
  scope: BackgroundRemovalScope
  /** Hugging Face repository the weights were downloaded from. */
  repo: string
  /** Commit the download is pinned to, so the bytes cannot change underneath. */
  revision: string
  file: string
  bytes: number
  sha256: string
  precision: 'fp32' | 'fp16' | 'uint8'
  licence: string
  /** The page whose wording the licence column transcribes. */
  licenceUrl: string
  downloadUrl: string
  /** Preprocessing the record measured; T19 has to reproduce it exactly. */
  input: { width: number, height: number, mean: number[], std: number[], scale: number }
  output: { activation: 'sigmoid' | 'minmax' | 'none' }
}

function downloadUrl(repo: string, revision: string, file: string) {
  return `https://huggingface.co/${repo}/resolve/${revision}/${file}`
}

const measured = [
  {
    id: 'birefnet-lite-fp32',
    family: 'birefnet-lite',
    scope: 'general',
    repo: 'onnx-community/BiRefNet_lite-ONNX',
    revision: 'de15b22ba131738a16dff04aab8bdf8dc32e3ac1',
    file: 'onnx/model.onnx',
    bytes: 224005088,
    sha256: '5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333',
    precision: 'fp32',
    licence: 'MIT',
    licenceUrl: 'https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE',
    input: { width: 1024, height: 1024, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], scale: 1 / 255 },
    output: { activation: 'sigmoid' },
  },
  {
    id: 'birefnet-lite-fp16',
    family: 'birefnet-lite',
    scope: 'general',
    repo: 'onnx-community/BiRefNet_lite-ONNX',
    revision: 'de15b22ba131738a16dff04aab8bdf8dc32e3ac1',
    file: 'onnx/model_fp16.onnx',
    bytes: 114538221,
    sha256: 'd39b897ceb16ae654c1731f3dba0cf9b368d9cae74b5a57459b455cc8bfec402',
    precision: 'fp16',
    licence: 'MIT',
    licenceUrl: 'https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE',
    input: { width: 1024, height: 1024, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], scale: 1 / 255 },
    output: { activation: 'sigmoid' },
  },
  {
    id: 'isnet-general-fp32',
    family: 'isnet-general',
    scope: 'general',
    repo: 'imgly/isnet-general-onnx',
    revision: '440dea96dd4a3b06bbbf5abec3e26569dd7ec49f',
    file: 'onnx/model.onnx',
    bytes: 176149806,
    sha256: 'cc2c9f5c1751b9737cb81e708ff0c5e9542c2205daed22418a4fd2ab5d4c481a',
    precision: 'fp32',
    licence: 'MIT（發布者聲明）',
    licenceUrl: 'https://huggingface.co/imgly/isnet-general-onnx',
    input: { width: 1024, height: 1024, mean: [128, 128, 128], std: [256, 256, 256], scale: 1 },
    output: { activation: 'minmax' },
  },
  {
    id: 'isnet-general-fp16',
    family: 'isnet-general',
    scope: 'general',
    repo: 'imgly/isnet-general-onnx',
    revision: '440dea96dd4a3b06bbbf5abec3e26569dd7ec49f',
    file: 'onnx/model_fp16.onnx',
    bytes: 88152708,
    sha256: '2eb4b5dda7ec41c617e59706e5aafa1f978c9a5f983d2518d9f0ae4d6eb04f20',
    precision: 'fp16',
    licence: 'MIT（發布者聲明）',
    licenceUrl: 'https://huggingface.co/imgly/isnet-general-onnx',
    input: { width: 1024, height: 1024, mean: [128, 128, 128], std: [256, 256, 256], scale: 1 },
    output: { activation: 'minmax' },
  },
  {
    id: 'modnet-fp32',
    family: 'modnet',
    scope: 'portrait',
    repo: 'Xenova/modnet',
    revision: 'fa2fa546052fba4c08921230a26cc69a333fca12',
    file: 'onnx/model.onnx',
    bytes: 25888640,
    sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9',
    precision: 'fp32',
    licence: 'Apache-2.0',
    licenceUrl: 'https://github.com/ZHKKKe/MODNet/blob/master/LICENSE',
    input: { width: 512, height: 512, mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5], scale: 1 / 255 },
    output: { activation: 'none' },
  },
  {
    id: 'modnet-fp16',
    family: 'modnet',
    scope: 'portrait',
    repo: 'Xenova/modnet',
    revision: 'fa2fa546052fba4c08921230a26cc69a333fca12',
    file: 'onnx/model_fp16.onnx',
    bytes: 12984781,
    sha256: '25f165da9bfd30830a575f1f0490f1acd995975cb349bc02f3d79332e1fe5cf6',
    precision: 'fp16',
    licence: 'Apache-2.0',
    licenceUrl: 'https://github.com/ZHKKKe/MODNet/blob/master/LICENSE',
    input: { width: 512, height: 512, mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5], scale: 1 / 255 },
    output: { activation: 'none' },
  },
  {
    id: 'modnet-uint8',
    family: 'modnet',
    scope: 'portrait',
    repo: 'Xenova/modnet',
    revision: 'fa2fa546052fba4c08921230a26cc69a333fca12',
    file: 'onnx/model_quantized.onnx',
    bytes: 6632188,
    sha256: '92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a',
    precision: 'uint8',
    licence: 'Apache-2.0',
    licenceUrl: 'https://github.com/ZHKKKe/MODNet/blob/master/LICENSE',
    input: { width: 512, height: 512, mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5], scale: 1 / 255 },
    output: { activation: 'none' },
  },
] as const satisfies readonly Omit<BackgroundRemovalCandidate, 'downloadUrl'>[]

export const backgroundRemovalCandidates: BackgroundRemovalCandidate[] = measured.map(candidate => ({
  ...candidate,
  input: { ...candidate.input, mean: [...candidate.input.mean], std: [...candidate.input.std] },
  output: { ...candidate.output },
  downloadUrl: downloadUrl(candidate.repo, candidate.revision, candidate.file),
}))

/** Why a family was screened out before any browser measured it. */
export const backgroundRemovalExclusionReasons = [
  'non-commercial-licence',
  'contradictory-licence',
  'copyleft-licence',
  'humans-only-scope',
] as const

export type BackgroundRemovalExclusionReason = typeof backgroundRemovalExclusionReasons[number]

export interface BackgroundRemovalExclusion {
  id: string
  repo: string
  reason: BackgroundRemovalExclusionReason
  /** The page whose own wording the exclusion rests on. */
  sourceUrl: string
}

export const backgroundRemovalExclusions: BackgroundRemovalExclusion[] = [
  { id: 'rmbg-1.4', repo: 'briaai/RMBG-1.4', reason: 'non-commercial-licence', sourceUrl: 'https://huggingface.co/briaai/RMBG-1.4' },
  { id: 'rmbg-2.0', repo: 'briaai/RMBG-2.0', reason: 'non-commercial-licence', sourceUrl: 'https://huggingface.co/briaai/RMBG-2.0' },
  { id: 'isnet-agpl', repo: 'onnx-community/ISNet-ONNX', reason: 'copyleft-licence', sourceUrl: 'https://huggingface.co/onnx-community/ISNet-ONNX' },
  { id: 'ormbg', repo: 'schirrmacher/ormbg', reason: 'humans-only-scope', sourceUrl: 'https://huggingface.co/schirrmacher/ormbg' },
]

/**
 * The capability ladder, best tier first. A device is placed on the highest tier
 * it can prove before a model file is fetched, so an unsupported browser never
 * pays for a download it cannot use.
 */
export const backgroundRemovalCapabilityLevels = [
  'webgpu-fp16',
  'webgpu-fp32',
  'wasm-simd-threads',
  'unsupported',
] as const

export type BackgroundRemovalCapabilityLevel = typeof backgroundRemovalCapabilityLevels[number]

/** Every state the tool has to be able to explain and recover from. */
export const backgroundRemovalFailureCodes = [
  'unsupported_browser',
  'model_download_failed',
  'model_digest_mismatch',
  'insufficient_memory',
  'inference_failed',
  'cancelled',
] as const

export type BackgroundRemovalFailureCode = typeof backgroundRemovalFailureCodes[number]

/** The budgets §12.8 of the specification set, restated in machine units. */
export const backgroundRemovalBudgets = {
  maxCompressedTransferBytes: 40 * 1024 * 1024,
  desktopCachedRunMs: 30000,
  mobileCachedRunMs: 60000,
} as const

export type BackgroundRemovalGateVerdict = 'pass' | 'fail' | 'conditional'

export interface BackgroundRemovalDecision {
  /** `go` needs every gate to pass; anything else has to say what is missing. */
  status: 'go' | 'conditional-go' | 'no-go'
  /** The best candidate that clears licence, budget and the baseline. */
  selectedCandidateId: string
  /** What the selection may be used for. It is not the tool §12.8 describes. */
  selectedScope: BackgroundRemovalScope
  /** The tier below the selection, or null when there is nothing to fall back to. */
  fallbackCandidateId: string | null
  /** Compressed bytes an approval would have to cover, null when inside budget. */
  transferExceptionBytes: number | null
  /** Exactly the gates that failed. Empty only when the status is `go`. */
  blockingGates: string[]
  gateVerdicts: Record<string, BackgroundRemovalGateVerdict>
}

/**
 * No candidate delivers the general-purpose tool the specification describes.
 * MODNet is the only family that is redistributable, runs on the WebAssembly
 * baseline in all three browsers and stays inside the transfer budget, and it
 * is trained for people, not products — so the decision is a no-go with one
 * narrower option attached rather than a selection.
 */
export const backgroundRemovalDecision: BackgroundRemovalDecision = {
  status: 'no-go',
  selectedCandidateId: 'modnet-fp16',
  selectedScope: 'portrait',
  fallbackCandidateId: 'modnet-fp32',
  transferExceptionBytes: null,
  blockingGates: ['general-scope', 'wasm-baseline', 'transfer-budget'],
  gateVerdicts: {
    'licence': 'pass',
    'general-scope': 'fail',
    'wasm-baseline': 'fail',
    'transfer-budget': 'fail',
    'desktop-latency': 'conditional',
    'memory-headroom': 'conditional',
    'mask-quality': 'conditional',
    'privacy': 'pass',
  },
}
