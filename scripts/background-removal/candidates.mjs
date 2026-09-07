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
  files: [
    'ort.all.min.mjs',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.asyncify.mjs',
    'ort-wasm-simd-threaded.asyncify.wasm',
  ],
}

/**
 * Families share an architecture, a training lineage and therefore a licence
 * question. Precision variants of one family are separate candidates because
 * transfer size, supported execution provider and output quality all differ.
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
    licence: 'MIT (publisher claim)',
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
    licence: 'MIT (publisher claim)',
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
]
