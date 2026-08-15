import { Context } from '@deepseek-ai/cordis'
import type { StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_REVISION,
  QWEN_VISION_SETTINGS_NAMESPACE,
  QwenVisionBackend,
} from '../src/qwen-backend.ts'

class MemorySettings extends SettingsProvider {
  private doc: Record<string, unknown> = {}

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc = { ...this.doc, [ns]: structuredClone(section) }
    return Promise.resolve()
  }
}

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
  processor: ReturnType<typeof vi.fn> & {
    apply_chat_template: ReturnType<typeof vi.fn>
    decode: ReturnType<typeof vi.fn>
  }
  interrupt: ReturnType<typeof vi.fn>
}

function runtimeFixture(): RuntimeFixture {
  const generated = { slice: vi.fn(() => 'completion-tokens') }
  const generate = vi.fn(async () => generated)
  const processor = Object.assign(
    vi.fn(async () => ({ input_ids: { dims: [1, 12] }, pixel_values: 'pixels' })),
    {
      apply_chat_template: vi.fn(() => '<qwen-prompt>'),
      decode: vi.fn(() => 'A chart with two bars labelled Revenue 2026.'),
    },
  )
  const fromModel = vi.fn(async () => ({ generate }))
  const fromProcessor = vi.fn(async () => processor)
  const interrupt = vi.fn()
  class FakeStoppingCriteria { interrupt = interrupt }
  class FakeStoppingCriteriaList { push(_item: unknown): void {} }
  return {
    runtime: {
      AutoModelForImageTextToText: { from_pretrained: fromModel },
      AutoProcessor: { from_pretrained: fromProcessor },
      RawImage: { fromBlob: vi.fn(async () => 'decoded-image') },
      InterruptableStoppingCriteria: FakeStoppingCriteria,
      StoppingCriteriaList: FakeStoppingCriteriaList,
    },
    fromModel,
    fromProcessor,
    generate,
    processor,
    interrupt,
  }
}

function backend(fixture: RuntimeFixture): QwenVisionBackend {
  return new QwenVisionBackend(new Context(), {
    backend: 'qwen',
  }, async () => fixture.runtime as never, false, '/tmp/dsh-vision-test-cache')
}

describe('QwenVisionBackend', () => {
  const acceleratedDevice = process.platform === 'win32' ? 'dml' : 'webgpu'

  it('loads the newest q4 preset once, auto-selects acceleration, and returns only generated text', async () => {
    const fixture = runtimeFixture()
    const subject = backend(fixture)

    await expect(subject.describe({ image, focus: 'What is the revenue?' })).resolves.toBe(
      'A chart with two bars labelled Revenue 2026.',
    )
    await expect(subject.describe({ image })).resolves.toContain('Revenue 2026')

    expect(fixture.fromModel).toHaveBeenCalledTimes(1)
    expect(fixture.fromModel).toHaveBeenCalledWith(DEFAULT_MODEL_ID, expect.objectContaining({
      cache_dir: '/tmp/dsh-vision-test-cache',
      revision: DEFAULT_MODEL_REVISION,
      dtype: 'q4',
      device: acceleratedDevice,
      use_external_data_format: {
        'decoder_model_merged_q4.onnx': 1,
        'embed_tokens_q4.onnx': 1,
        'vision_encoder_q4.onnx': 1,
      },
      progress_callback: expect.any(Function),
    }))
    expect(fixture.fromProcessor).toHaveBeenCalledTimes(1)
    expect(fixture.generate).toHaveBeenCalledWith(expect.objectContaining({
      max_new_tokens: 384,
      do_sample: false,
      pixel_values: 'pixels',
    }))
    expect(fixture.processor.apply_chat_template).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
      { add_generation_prompt: true },
    )
    expect(JSON.stringify(fixture.processor.apply_chat_template.mock.calls[0])).toContain('What is the revenue?')
    expect(subject.model).toContain(`${DEFAULT_MODEL_ID}@${DEFAULT_MODEL_REVISION}:q4`)
  })

  it('interrupts generation when the request is aborted', async () => {
    const fixture = runtimeFixture()
    let finish: (() => void) | undefined
    fixture.generate.mockImplementation(() => new Promise(resolve => {
      finish = () => resolve({ slice: () => 'completion-tokens' })
    }))
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
    fixture.fromModel.mockRejectedValueOnce(new Error('GPU provider unavailable'))
    const subject = backend(fixture)

    await expect(subject.describe({ image })).resolves.toContain('Revenue 2026')
    expect(fixture.fromModel).toHaveBeenCalledTimes(2)
    expect(fixture.fromModel.mock.calls[1]?.[1]).toMatchObject({ device: 'cpu' })
  })

  it('loads cached processor metadata without a remote metadata probe', async () => {
    const cache = await mkdtemp(join(tmpdir(), 'dsh-vision-processor-'))
    const localModel = join(cache, DEFAULT_MODEL_ID)
    await mkdir(localModel, { recursive: true })
    await Promise.all([
      writeFile(join(localModel, 'preprocessor_config.json'), '{}'),
      writeFile(join(localModel, 'tokenizer.json'), '{}'),
      writeFile(join(localModel, 'tokenizer_config.json'), '{}'),
    ])
    try {
      const fixture = runtimeFixture()
      const subject = new QwenVisionBackend(new Context(), { backend: 'qwen' }, async () => fixture.runtime as never, false, cache)

      await subject.describe({ image })

      expect(fixture.fromProcessor).toHaveBeenCalledWith(localModel, expect.any(Object))
    } finally {
      await rm(cache, { recursive: true, force: true })
    }
  })

  it('applies native plugin settings to the next inference and its evidence identity', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fixture = runtimeFixture()
    const subject = new QwenVisionBackend(ctx, {
      backend: 'qwen',
    }, async () => fixture.runtime as never, false, '/tmp/dsh-vision-test-cache')
    await vi.waitFor(() => {
      expect(ctx.settings.describe().map(row => String(row.ns))).toContain('dsh-vision')
    })

    await ctx.settings.update(QWEN_VISION_SETTINGS_NAMESPACE, {
      modelPreset: 'qwen2-vl-2b',
    })
    await subject.describe({ image })

    expect(fixture.fromModel).toHaveBeenCalledWith('onnx-community/Qwen2-VL-2B-Instruct', expect.objectContaining({
      device: acceleratedDevice,
      dtype: 'q4',
    }))
    expect(fixture.generate).toHaveBeenCalledWith(expect.objectContaining({ max_new_tokens: 384 }))
    expect(subject.model).toContain('Qwen2-VL-2B-Instruct@main:q4:max384')
    await ctx.fiber.dispose()
  })
})
