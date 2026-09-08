/**
 * What version one of the tool actually ships.
 *
 * `reference.ts` records everything T18 measured; this module makes one choice
 * out of it and turns that choice into the two versioned assets a device
 * downloads. Nothing here restates a number the record already owns: the
 * preprocessing, the licence and the file digest are read back from the
 * candidate so the two files can never drift apart.
 */
import {
  backgroundRemovalDecision,
  backgroundRemovalRuntime,
  redistributableCandidates,
  type BackgroundRemovalCandidate,
} from './reference'
import type { ToolOfflineAsset } from '../../catalog'

/**
 * The T18 record is a no-go for general-purpose removal and recommends exactly
 * one narrower option. Version one takes that option and nothing else, so the
 * selection is read from the decision rather than repeated here.
 */
function selectRecommendedCandidate(): BackgroundRemovalCandidate {
  const candidate = redistributableCandidates.find(entry => entry.id === backgroundRemovalDecision.recommendedCandidateId)
  if (!candidate) {
    throw new Error(`background removal: ${backgroundRemovalDecision.recommendedCandidateId} is not a redistributable candidate`)
  }
  if (candidate.scope !== backgroundRemovalDecision.recommendedScope) {
    throw new Error(`background removal: ${candidate.id} is not scoped to ${backgroundRemovalDecision.recommendedScope}`)
  }
  return candidate
}

const recommended = selectRecommendedCandidate()

/**
 * Bumped whenever the weights change. It is part of the asset URL and of the
 * cache key, so a new version is a new download rather than an overwrite, and a
 * device that still holds the old bytes is never mistaken for prepared.
 */
export const portraitModelVersion = 'modnet-fp16-1'

/**
 * Spelled out rather than composed from the registry's own constant: the tool
 * definition is what the registry loads, so reading a value back out of it here
 * would make the two modules import each other. `offlineAssetPathPrefix` still
 * governs the shape, and the tests hold these paths to it.
 */
const assetRoot = '/assets/offline'

export interface PortraitMattingModel {
  candidateId: string
  scope: BackgroundRemovalCandidate['scope']
  licence: string
  input: BackgroundRemovalCandidate['input']
  output: BackgroundRemovalCandidate['output']
}

/** The matting model, with the preprocessing T18 measured it under. */
export const portraitMattingModel: PortraitMattingModel = {
  candidateId: recommended.id,
  scope: recommended.scope,
  licence: recommended.licence,
  input: recommended.input,
  output: recommended.output,
}

export const portraitModelAsset: ToolOfflineAsset = {
  id: 'portrait-matting-model',
  version: portraitModelVersion,
  url: `${assetRoot}/image-background-remover/${portraitModelVersion}/portrait-matting.onnx`,
  bytes: recommended.bytes,
  sha256: recommended.sha256,
  label: {
    'zh-tw': '人像去背模型',
    en: 'Portrait background removal model',
  },
}

/**
 * The runtime's loader, kept out of the worker bundle on purpose. A worker that
 * bundles a dependency does not build to the same bytes on the client and the
 * server, so its hashed file name could not be declared by a server render —
 * and an undeclared worker never reaches the offline cache. Serving the loader
 * as its own versioned asset keeps the worker to application code only.
 */
export const inferenceRuntimeModuleAsset: ToolOfflineAsset = {
  id: 'inference-runtime-loader',
  version: backgroundRemovalRuntime.version,
  url: `${assetRoot}/onnxruntime-web/${backgroundRemovalRuntime.version}/ort.wasm.bundle.min.mjs`,
  bytes: 72894,
  sha256: '7a3913dc5c7a9c3ad1144f5fbfecd402bc5013bcc886bc67664b18d8a15ab298',
  label: {
    'zh-tw': '本機推論 runtime 載入器',
    en: 'Local inference runtime loader',
  },
}

export const inferenceRuntimeAsset: ToolOfflineAsset = {
  id: 'inference-runtime',
  version: backgroundRemovalRuntime.version,
  url: `${assetRoot}/onnxruntime-web/${backgroundRemovalRuntime.version}/ort-wasm-simd-threaded.wasm`,
  bytes: 13961845,
  sha256: 'ec8580a9d7b9476ceee52e10a7f94124e4dc71a019d666ed6d4726697c109a4d',
  label: {
    'zh-tw': '本機推論 runtime',
    en: 'Local inference runtime',
  },
}

/** Every file a device needs before it can remove a background locally. */
export const backgroundRemovalAssets: ToolOfflineAsset[] = [portraitModelAsset, inferenceRuntimeAsset, inferenceRuntimeModuleAsset]
