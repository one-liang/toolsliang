/**
 * The candidate set T18 measures, pinned by repository commit and file digest.
 *
 * Every entry names where the weights come from, what the publisher licenses
 * them under and how the file has to be preprocessed, so a later run downloads
 * exactly the same bytes or fails. Licence wording is transcribed from the
 * publisher page named in `licenceUrl`; nothing here is inferred from a file
 * name or a Hugging Face tag alone.
 */

/** Pinned onnxruntime-web build. MIT, downloaded from the npm CDN at eval time. */
export const runtime = {
  id: 'onnxruntime-web',
  version: '1.29.0',
  licence: 'MIT',
  base: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/',
  /* Pinned like the weights: the runtime decides what the numbers mean, so a
   * changed byte has to stop the run rather than be recorded after the fact. */
  files: [
    { file: 'ort.all.min.mjs', sha256: 'e7a1ea699f25bdeeb3d9b9ff7ea26edb660fd15cab380e2fe479809d422f5e8b' },
    { file: 'ort-wasm-simd-threaded.mjs', sha256: '5a15f1fd086b3f6c2baf1f35105b8f502653b567e165cef80028870b39748747' },
    { file: 'ort-wasm-simd-threaded.wasm', sha256: 'ec8580a9d7b9476ceee52e10a7f94124e4dc71a019d666ed6d4726697c109a4d' },
    { file: 'ort-wasm-simd-threaded.jsep.mjs', sha256: '3d68fa7af88c48894d4b0c8629de12018ab73b77519bc0b05dc8d908ad82749f' },
    { file: 'ort-wasm-simd-threaded.jsep.wasm', sha256: 'db816fadbab47a755170c08f933961e231412ac17f5981f9a62e519708a44dea' },
    { file: 'ort-wasm-simd-threaded.asyncify.mjs', sha256: '5d25483158d53d8f34d0e9c06a654d56c8dca4ebdf370ea0982ef11315a00e0e' },
    { file: 'ort-wasm-simd-threaded.asyncify.wasm', sha256: '503d17cb7411b79781b9fad1cf0978f03cf06b050c7d399c730e914f473bf549' },
  ],
}

/**
 * Families share an architecture, a training lineage and therefore a licence
 * question. Precision variants of one family are separate candidates because
 * transfer size, supported execution provider and output quality all differ.
 *
 * `licence` is the identifier the publisher declares; `licenceVerified` says
 * whether the publisher, the upstream weights page and the upstream repository
 * agree. A candidate may be measured either way, but only a verified one may be
 * redistributed from this project's own assets.
 */
export const candidates = [
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
    licenceVerified: true,
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
    licenceVerified: true,
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
    licence: 'MIT',
    licenceVerified: false,
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
    licence: 'MIT',
    licenceVerified: false,
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
    licenceVerified: true,
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
    licenceVerified: true,
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
    licenceVerified: true,
    licenceUrl: 'https://github.com/ZHKKKe/MODNet/blob/master/LICENSE',
    input: { width: 512, height: 512, mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5], scale: 1 / 255 },
    output: { activation: 'none' },
  },
]
