/** Vision-to-text wrapper adapter for DeepSeek Harness. @module dsh-vision/adapter */

import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import {
  LlmAdapter,
  LlmError,
} from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock,
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  Message,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { isVisionMessageSource } from './descriptions.ts'
import type { VisionDescription, VisionDescriptionStore } from './descriptions.ts'

/** Constructor dependencies fixed for one adapter registration. */
export interface VisionAdapterOptions {
  /** Synthetic route registered by this adapter. */
  provider: string
  /** Human-readable synthetic route name. */
  displayName: string
  /** Text-only provider receiving transformed requests. */
  downstreamProvider: string
  /** Text-only model receiving transformed requests. */
  downstreamModel: string
  /** Harness LLM streaming entry point used for delegation. */
  stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
  /** Durable image byte resolver. */
  attachments: AttachmentStore
  /** Durable description resolver. */
  descriptions: VisionDescriptionStore
}

function visualEvidence(description: VisionDescription): string {
  const ref = description.attachment
  const label = ref.name === undefined ? String(ref.attachmentId) : ref.name
  return [
    '<visual-evidence>',
    `image: ${label} (${ref.mediaType}, ${ref.width}x${ref.height})`,
    `analyzer: ${description.model}; prompt: ${description.promptVersion}`,
    description.text,
    '</visual-evidence>',
  ].join('\n')
}

async function transformBlocks(
  blocks: readonly ContentBlock[],
  options: GenerateOptions,
  dependencies: Pick<VisionAdapterOptions, 'attachments' | 'descriptions'>,
): Promise<ContentBlock[]> {
  const transformed: ContentBlock[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'image': {
        if (options.sessionId === undefined) {
          throw new LlmError('dsh-vision requires a session id before it can persist visual evidence', 'VISION_SESSION_REQUIRED')
        }
        const image = await dependencies.attachments.readImage(block.attachment, options.signal)
        const description = await dependencies.descriptions.resolve({ sessionId: options.sessionId, image }, options.signal)
        transformed.push({ type: 'text', text: visualEvidence(description) })
        break
      }
      case 'tool-result':
        transformed.push({
          ...block,
          content: await transformBlocks(block.content, options, dependencies),
        })
        break
      default:
        transformed.push(structuredClone(block))
        break
    }
  }
  return transformed
}

async function transformMessages(
  options: GenerateOptions,
  dependencies: Pick<VisionAdapterOptions, 'attachments' | 'descriptions'>,
): Promise<Message[]> {
  const visible = options.messages.filter(message => !isVisionMessageSource(message.source))
  return Promise.all(visible.map(async message => ({
    ...message,
    content: await transformBlocks(message.content, options, dependencies),
  })))
}

/** Adapter exposing a vision route while delegating generated text to DeepSeek. */
export class VisionAdapter extends LlmAdapter {
  constructor(private readonly options: VisionAdapterOptions) {
    super()
    if (options.provider === options.downstreamProvider) {
      throw new LlmError('dsh-vision provider and downstream provider must differ', 'VISION_RECURSIVE_ROUTE')
    }
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: this.options.displayName }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve([{
      provider,
      id: this.options.downstreamModel,
      name: `${this.options.downstreamModel} + local vision`,
      description: `Local visual analysis delegated to ${this.options.downstreamProvider}/${this.options.downstreamModel}`,
      inputModalities: ['text', 'image'],
    }])
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    if (model !== this.options.downstreamModel) {
      return Promise.reject(new LlmError(`dsh-vision does not expose model "${model}"`, 'VISION_MODEL_MISMATCH'))
    }
    return Promise.resolve({
      provider,
      id: model,
      name: `${model} + local vision`,
      inputModalities: ['text', 'image'],
    })
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.model !== this.options.downstreamModel) {
      throw new LlmError(`dsh-vision does not expose model "${options.model}"`, 'VISION_MODEL_MISMATCH')
    }
    const messages = await transformMessages(options, this.options)
    const downstream: GenerateOptions = {
      ...options,
      provider: this.options.downstreamProvider,
      model: this.options.downstreamModel,
      messages,
    }
    yield* this.options.stream(downstream)
  }
}
