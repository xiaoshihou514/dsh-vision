/** Local vision bridge for DeepSeek Harness. @module dsh-vision */

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
  QWEN_VISION_SETTINGS_NAMESPACE,
  QwenVisionBackend,
} from './qwen-backend.ts'
export type { QwenDevice, QwenDtype, VisionBackendKind } from './qwen-backend.ts'
