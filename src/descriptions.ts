/** Durable visual-description service used by the adapter. @module dsh-vision/descriptions */

import { Context, Service } from '@deepseek-ai/cordis'
import type { ImageAttachmentRef, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/cordis' {
  interface Context {
    visionDescriptions: VisionDescriptionStore
  }
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    vision: VisionMessageSource
  }
}

/** Durable provenance carried by the core user message that stores one description. */
export interface VisionMessageSource {
  kind: 'vision'
  plugin: 'dsh-vision'
  cacheKey: string
  attachment: ImageAttachmentRef
  model: string
  promptVersion: string
}

/** Input needed to find or produce one durable image description. */
export interface VisionDescriptionRequest {
  /** Session whose log owns the description message. */
  sessionId: NonNullable<GenerateOptions['sessionId']>
  /** Verified image bytes and canonical durable reference. */
  image: StoredImageAttachment
}

/** Visual evidence persisted before it becomes visible to the downstream model. */
export interface VisionDescription {
  /** Stable derivation key for this attachment and analyzer configuration. */
  cacheKey: string
  /** Reference described by this record. */
  attachment: ImageAttachmentRef
  /** Versioned local model identity, including quantization where relevant. */
  model: string
  /** Version of the analysis prompt and text rendering contract. */
  promptVersion: string
  /** Plain-text observation supplied to the downstream text model. */
  text: string
}

/** Return whether a message source is a description persisted by this plugin. */
export function isVisionMessageSource(source: { kind: string }): source is VisionMessageSource {
  return source.kind === 'vision'
}

/**
 * Durable visual-description repository and inference owner.
 * Implementations append a core user message before returning newly produced evidence.
 */
export abstract class VisionDescriptionStore extends Service {
  constructor(ctx: Context) {
    super(ctx, 'visionDescriptions')
  }

  /**
   * Reuse or create one description, publishing new output durably before return.
   * @param request - owning session and verified image.
   * @param signal - cancellation shared with the model request.
   * @returns persisted visual evidence for the exact derivation identity.
   */
  abstract resolve(request: VisionDescriptionRequest, signal?: AbortSignal): Promise<VisionDescription>
}

export default VisionDescriptionStore
