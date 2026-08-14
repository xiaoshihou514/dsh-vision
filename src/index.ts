/** Local vision bridge for DeepSeek Harness. @module dsh-vision */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { VisionAdapter } from './adapter.ts'

export { VisionAdapter } from './adapter.ts'
export type { VisionAdapterOptions } from './adapter.ts'
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
export { DurableVisionDescriptionStore, descriptionCacheKey } from './durable-descriptions.ts'
export { isVisionMessageSource, VisionDescriptionStore } from './descriptions.ts'
export type { VisionDescription, VisionDescriptionRequest, VisionMessageSource } from './descriptions.ts'
export {
  DEFAULT_MAX_NEW_TOKENS,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_REVISION,
  QWEN_VISION_SETTINGS_NAMESPACE,
  QwenVisionBackend,
} from './qwen-backend.ts'
export type { QwenDevice, QwenDtype, VisionBackendKind } from './qwen-backend.ts'

/** Stable Cordis plugin name. */
export const name = 'vision-adapter'

/** Services required by the vision wrapper. */
export const inject = ['attachments', 'llm', 'visionDescriptions']

/** Vision wrapper route configuration. */
export interface Config {
  /** Synthetic provider route selected by Harness agents. */
  provider?: string
  /** Human-readable provider name. */
  displayName?: string
  /** Existing text-only route that receives transformed requests. */
  downstreamProvider: string
  /** Model on the downstream route. */
  downstreamModel: string
  /** Downstream text models that should also appear as image-capable wrapper routes. */
  downstreamModels?: string[]
}

export const Config: z<Config> = z.object({
  provider: z.string().default('dsh-vision'),
  displayName: z.string().default('DeepSeek + local vision'),
  downstreamProvider: z.string().required(),
  downstreamModel: z.string().required(),
  downstreamModels: z.array(z.string()).default([]),
})

/**
 * Register the synthetic image-capable route.
 * @param ctx - plugin context carrying attachments, descriptions, and LLM routing.
 * @param config - validated route configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const provider = config.provider ?? 'dsh-vision'
  const adapter = new VisionAdapter({
    provider,
    displayName: config.displayName ?? 'DeepSeek + local vision',
    downstreamProvider: config.downstreamProvider,
    downstreamModel: config.downstreamModel,
    ...config.downstreamModels === undefined ? {} : { downstreamModels: config.downstreamModels },
    stream: options => ctx.llm.stream(options),
    attachments: ctx.attachments,
    descriptions: ctx.visionDescriptions,
  })
  ctx.llm.registerAdapter([provider], adapter)
}
