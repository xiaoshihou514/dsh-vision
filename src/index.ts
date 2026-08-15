/** Local vision bridge for DeepSeek Harness. @module dsh-vision */

/** Root loader entry used to make the package's browser contribution discoverable. */
export const name = 'vision-client-bridge'

/** The root entry owns no host behavior; functional host plugins use exported subpaths. */
export function apply(): void {}

export { VisionBackend } from './backend.ts'
export type { VisionBackendRequest } from './backend.ts'
export {
  DEFAULT_GLM_BASE_URL,
  DEFAULT_GLM_FALLBACK_MODELS,
  DEFAULT_GLM_MODEL,
  GlmVisionHttpError,
  glmVisionChat,
} from './glm-backend.ts'
export type { GlmVisionRequest } from './glm-backend.ts'
export {
  DEFAULT_MAX_NEW_TOKENS,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_REVISION,
  DEFAULT_CACHE_DIR,
  GLM_API_KEY_CREDENTIAL,
  QWEN_MODEL_PRESETS,
  QWEN_VISION_SETTINGS_NAMESPACE,
  QwenVisionBackend,
} from './qwen-backend.ts'
export type { QwenModelPreset, VisionBackendKind } from './qwen-backend.ts'
