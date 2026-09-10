export interface EngineProgress { stage: string, completed: number, total?: number }
/** `enter-password` exists for documents whose own security handler is the obstacle; §12.12 declares password support as its own capability. */
export interface EngineError { code: string, recoverable: boolean, suggestedAction: 'retry' | 'change-input' | 'use-supported-browser' | 'enter-password' }
export type EngineOutcome<T> = { status: 'success', output: T } | { status: 'cancelled' } | { status: 'error', error: EngineError }
export interface EngineCapabilities { supported: boolean, formats: string[], reason?: string }
export interface RunContext { signal?: AbortSignal, onProgress?: (progress: EngineProgress) => void }
export interface ToolEngine<Input, Output> {
  capabilities(): Promise<EngineCapabilities>
  prepare(): Promise<EngineCapabilities>
  run(input: Input, context?: RunContext): Promise<EngineOutcome<Output>>
  cancel(): void
  dispose(): void
}
export function engineError(code: string): EngineError {
  return { code, recoverable: code !== 'disposed', suggestedAction: code === 'unsupported_browser' ? 'use-supported-browser' : ['unsupported_heic', 'unsupported_format', 'invalid_options', 'too_large', 'corrupt_image'].includes(code) ? 'change-input' : 'retry' }
}
