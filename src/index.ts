/** Local vision bridge for DeepSeek Harness. @module dsh-vision */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { VisionAdapter } from './adapter.ts'

export { VisionAdapter } from './adapter.ts'
export type { VisionAdapterOptions } from './adapter.ts'
export { VisionDescriptionStore } from './descriptions.ts'
export type { VisionDescription, VisionDescriptionRequest } from './descriptions.ts'

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
}

export const Config: z<Config> = z.object({
  provider: z.string().default('dsh-vision'),
  displayName: z.string().default('DeepSeek + local vision'),
  downstreamProvider: z.string().required(),
  downstreamModel: z.string().required(),
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
    stream: options => ctx.llm.stream(options),
    attachments: ctx.attachments,
    descriptions: ctx.visionDescriptions,
  })
  ctx.llm.registerAdapter([provider], adapter)
}
