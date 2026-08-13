/** Florence-2 backend powered by Transformers.js and ONNX Runtime. @module dsh-vision/transformers-backend */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { VisionBackend } from './backend.ts'
import type { VisionBackendRequest } from './backend.ts'

/** Pinned model repository. */
export const DEFAULT_MODEL_ID = 'onnx-community/Florence-2-base-ft'
/** Pinned immutable model revision. */
export const DEFAULT_MODEL_REVISION = 'e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f'
/** Florence task used for general visual evidence. */
export const DEFAULT_TASK = '<MORE_DETAILED_CAPTION>'
/** Output bound for one description. */
export const DEFAULT_MAX_NEW_TOKENS = 192

type Transformers = typeof import('@huggingface/transformers')
type FlorenceProcessor = Awaited<ReturnType<Transformers['AutoProcessor']['from_pretrained']>> & {
  construct_prompts(text: string): string[]
  post_process_generation(text: string, task: string, imageSize: [number, number]): Record<string, unknown>
  batch_decode(tokens: unknown, options: { skip_special_tokens: boolean }): string[]
}
type FlorenceModel = Awaited<ReturnType<Transformers['Florence2ForConditionalGeneration']['from_pretrained']>>

interface LoadedFlorence {
  model: FlorenceModel
  processor: FlorenceProcessor
  runtime: Transformers
}

/** Local backend configuration. */
export interface Config {
  /** Hugging Face model repository. */
  modelId?: string
  /** Immutable repository revision. */
  revision?: string
  /** ONNX weight format. */
  dtype?: 'q4' | 'q8' | 'fp16' | 'fp32'
  /** Model cache root. Defaults below `DSH_HOME`. */
  cacheDir?: string
  /** Maximum tokens generated for one description. */
  maxNewTokens?: number
  /** Florence task prompt. */
  task?: '<CAPTION>' | '<DETAILED_CAPTION>' | '<MORE_DETAILED_CAPTION>' | '<OCR>'
}

export const Config: z<Config> = z.object({
  modelId: z.string().default(DEFAULT_MODEL_ID),
  revision: z.string().default(DEFAULT_MODEL_REVISION),
  dtype: z.union(['q4', 'q8', 'fp16', 'fp32'] as const).default('q4'),
  cacheDir: z.string(),
  maxNewTokens: z.number().step(1).min(1).max(1024).default(DEFAULT_MAX_NEW_TOKENS),
  task: z.union(['<CAPTION>', '<DETAILED_CAPTION>', '<MORE_DETAILED_CAPTION>', '<OCR>'] as const)
    .default(DEFAULT_TASK),
})

function defaultCacheDir(): string {
  const dshHome = process.env.DSH_HOME?.trim()
  return resolve(join(dshHome === undefined || dshHome === '' ? join(homedir(), '.dsh') : dshHome, 'models', 'dsh-vision'))
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
}

function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return promise
  if (signal.aborted) return Promise.reject(abortReason(signal))
  return new Promise<T>((resolvePromise, reject) => {
    const aborted = (): void => reject(abortReason(signal))
    signal.addEventListener('abort', aborted, { once: true })
    void promise.then(resolvePromise, reject).finally(() => signal.removeEventListener('abort', aborted))
  })
}

/** CPU-first Florence-2 implementation with lazy model loading and serialized inference. */
export class TransformersVisionBackend extends VisionBackend {
  readonly model: string
  readonly promptVersion: string
  private loaded: Promise<LoadedFlorence> | undefined
  private inferenceTail: Promise<void> = Promise.resolve()

  constructor(
    ctx: Context,
    private readonly config: Required<Omit<Config, 'cacheDir'>> & { cacheDir: string },
    private readonly loadRuntime: () => Promise<Transformers> = () => import('@huggingface/transformers'),
  ) {
    super(ctx)
    this.model = `${config.modelId}@${config.revision}:${config.dtype}`
    this.promptVersion = `florence2:${config.task}:tokens-${config.maxNewTokens}:v1`
  }

  override describe(request: VisionBackendRequest): Promise<string> {
    const run = this.inferenceTail.then(async () => {
      if (request.signal?.aborted) throw abortReason(request.signal)
      return this.infer(request)
    })
    this.inferenceTail = run.then(() => undefined, () => undefined)
    return run
  }

  private async infer(request: VisionBackendRequest): Promise<string> {
    const loaded = await waitFor(this.load(), request.signal)
    const bytes = request.image.data.slice().buffer as ArrayBuffer
    const image = await loaded.runtime.RawImage.fromBlob(new Blob([bytes], { type: request.image.ref.mediaType }))
    const prompts = loaded.processor.construct_prompts(this.config.task)
    const inputs = await loaded.processor(image, prompts)
    const stopping = new loaded.runtime.InterruptableStoppingCriteria()
    const criteria = new loaded.runtime.StoppingCriteriaList()
    criteria.push(stopping)
    const abort = (): void => stopping.interrupt()
    request.signal?.addEventListener('abort', abort, { once: true })
    try {
      const generated = await loaded.model.generate({
        ...inputs,
        max_new_tokens: this.config.maxNewTokens,
        stopping_criteria: criteria,
      })
      if (request.signal?.aborted) throw abortReason(request.signal)
      const decoded = loaded.processor.batch_decode(generated, { skip_special_tokens: false })[0]
      if (decoded === undefined) throw new Error('Florence-2 returned no decoded output')
      const result = loaded.processor.post_process_generation(decoded, this.config.task, image.size)
      const text = result[this.config.task]
      if (typeof text !== 'string') throw new Error(`Florence-2 returned an unsupported result for ${this.config.task}`)
      return text.trim()
    } finally {
      request.signal?.removeEventListener('abort', abort)
    }
  }

  private load(): Promise<LoadedFlorence> {
    this.loaded ??= this.loadFresh().catch((error: unknown) => {
      this.loaded = undefined
      throw error
    })
    return this.loaded
  }

  private async loadFresh(): Promise<LoadedFlorence> {
    const runtime = await this.loadRuntime()
    const options = {
      cache_dir: this.config.cacheDir,
      revision: this.config.revision,
    }
    const [model, processor] = await Promise.all([
      runtime.Florence2ForConditionalGeneration.from_pretrained(this.config.modelId, {
        ...options,
        dtype: this.config.dtype,
      }),
      runtime.AutoProcessor.from_pretrained(this.config.modelId, options),
    ])
    return { model, processor: processor as FlorenceProcessor, runtime }
  }
}

/** Cordis provider name. */
export const name = 'vision-transformers-backend'

/** Mount the local Florence-2 backend. */
export function apply(ctx: Context, config: Config): void {
  new TransformersVisionBackend(ctx, {
    modelId: config.modelId ?? DEFAULT_MODEL_ID,
    revision: config.revision ?? DEFAULT_MODEL_REVISION,
    dtype: config.dtype ?? 'q4',
    cacheDir: resolve(config.cacheDir ?? defaultCacheDir()),
    maxNewTokens: config.maxNewTokens ?? DEFAULT_MAX_NEW_TOKENS,
    task: config.task ?? DEFAULT_TASK,
  })
}
