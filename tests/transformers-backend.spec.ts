import { Context } from '@deepseek-ai/cordis'
import type { StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_REVISION,
  TransformersVisionBackend,
} from '../src/transformers-backend.ts'

const image = {
  ref: {
    attachmentId: 'sha256:image-one',
    mediaType: 'image/png',
    bytes: 4,
    width: 10,
    height: 20,
  },
  data: new Uint8Array([1, 2, 3, 4]),
} as StoredImageAttachment

interface RuntimeFixture {
  runtime: Record<string, unknown>
  fromModel: ReturnType<typeof vi.fn>
  fromProcessor: ReturnType<typeof vi.fn>
  generate: ReturnType<typeof vi.fn>
  interrupt: ReturnType<typeof vi.fn>
}

function runtimeFixture(): RuntimeFixture {
  const generate = vi.fn(async () => [[1, 2, 3]])
  const processor = Object.assign(
    vi.fn(async () => ({ input_ids: [[1]], pixel_values: 'pixels' })),
    {
      construct_prompts: vi.fn(() => ['Describe with detail.']),
      batch_decode: vi.fn(() => ['<s>A small chart with two bars.</s>']),
      post_process_generation: vi.fn((_text, task: string) => ({
        [task]: task === '<OCR>' ? 'Revenue 2026' : 'A small chart with two bars.',
      })),
    },
  )
  const fromModel = vi.fn(async () => ({ generate }))
  const fromProcessor = vi.fn(async () => processor)
  const interrupt = vi.fn()
  class FakeStoppingCriteria {
    interrupt = interrupt
  }
  class FakeStoppingCriteriaList {
    readonly items: unknown[] = []
    push(item: unknown): void {
      this.items.push(item)
    }
  }
  return {
    runtime: {
      Florence2ForConditionalGeneration: { from_pretrained: fromModel },
      AutoProcessor: { from_pretrained: fromProcessor },
      RawImage: { fromBlob: vi.fn(async () => ({ size: [10, 20] })) },
      InterruptableStoppingCriteria: FakeStoppingCriteria,
      StoppingCriteriaList: FakeStoppingCriteriaList,
    },
    fromModel,
    fromProcessor,
    generate,
    interrupt,
  }
}

function backend(fixture: RuntimeFixture): TransformersVisionBackend {
  return new TransformersVisionBackend(new Context(), {
    modelId: DEFAULT_MODEL_ID,
    revision: DEFAULT_MODEL_REVISION,
    dtype: 'q4',
    cacheDir: '/tmp/dsh-vision-test-cache',
    maxNewTokens: 192,
    task: '<MORE_DETAILED_CAPTION>',
    includeOcr: false,
  }, async () => fixture.runtime as never, false)
}

describe('TransformersVisionBackend', () => {
  it('loads a pinned quantized model once and returns post-processed text', async () => {
    const fixture = runtimeFixture()
    const subject = backend(fixture)

    await expect(subject.describe({ image })).resolves.toBe('A small chart with two bars.')
    await expect(subject.describe({ image })).resolves.toBe('A small chart with two bars.')

    expect(fixture.fromModel).toHaveBeenCalledTimes(1)
    expect(fixture.fromModel).toHaveBeenCalledWith(DEFAULT_MODEL_ID, {
      cache_dir: '/tmp/dsh-vision-test-cache',
      revision: DEFAULT_MODEL_REVISION,
      dtype: 'q4',
    })
    expect(fixture.fromProcessor).toHaveBeenCalledTimes(1)
    expect(fixture.generate).toHaveBeenCalledWith(expect.objectContaining({
      max_new_tokens: 192,
      pixel_values: 'pixels',
    }))
    expect(subject.model).toContain(`${DEFAULT_MODEL_ID}@${DEFAULT_MODEL_REVISION}:q4`)
  })

  it('adds OCR evidence when enabled', async () => {
    const fixture = runtimeFixture()
    const subject = new TransformersVisionBackend(new Context(), {
      modelId: DEFAULT_MODEL_ID,
      revision: DEFAULT_MODEL_REVISION,
      dtype: 'q4',
      cacheDir: '/tmp/dsh-vision-test-cache',
      maxNewTokens: 192,
      task: '<MORE_DETAILED_CAPTION>',
      includeOcr: true,
    }, async () => fixture.runtime as never, false)

    await expect(subject.describe({ image })).resolves.toBe(
      'A small chart with two bars.\n\nVisible text (OCR):\nRevenue 2026',
    )
    expect(fixture.generate).toHaveBeenCalledTimes(2)
  })

  it('interrupts token generation when the request is aborted', async () => {
    const fixture = runtimeFixture()
    let finish: (() => void) | undefined
    fixture.generate.mockImplementation(() => new Promise(resolve => finish = () => resolve([[1]])))
    const subject = backend(fixture)
    const controller = new AbortController()
    const pending = subject.describe({ image, signal: controller.signal })
    await vi.waitFor(() => expect(fixture.generate).toHaveBeenCalled())

    controller.abort(new Error('cancelled'))
    expect(fixture.interrupt).toHaveBeenCalledTimes(1)
    finish?.()
    await expect(pending).rejects.toThrow('cancelled')
  })

  it('retries initialization after a failed model load', async () => {
    const fixture = runtimeFixture()
    fixture.fromModel.mockRejectedValueOnce(new Error('download failed'))
    const subject = backend(fixture)

    await expect(subject.describe({ image })).rejects.toThrow('download failed')
    await expect(subject.describe({ image })).resolves.toBe('A small chart with two bars.')
    expect(fixture.fromModel).toHaveBeenCalledTimes(2)
  })
})
