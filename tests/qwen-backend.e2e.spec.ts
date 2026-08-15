import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_NEW_TOKENS,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_REVISION,
  QwenVisionBackend,
} from '../src/qwen-backend.ts'

const imagePath = process.env.DSH_VISION_E2E_IMAGE
const run = imagePath === undefined ? describe.skip : describe

run('QwenVisionBackend end to end', () => {
  it('answers a focused visual question with the selected local model', async () => {
    const data = await readFile(imagePath!)
    const image = {
      ref: {
        attachmentId: `e2e:${basename(imagePath!)}`,
        mediaType: 'image/png',
        bytes: data.byteLength,
        width: 1,
        height: 1,
      },
      data,
    } as unknown as StoredImageAttachment
    const backend = new QwenVisionBackend(new Context(), {
      backend: 'qwen',
      modelPreset: process.env.DSH_VISION_E2E_PRESET === 'qwen2-vl-2b' ? 'qwen2-vl-2b' : 'qwen3-vl-2b',
    }, undefined, true, process.env.DSH_VISION_E2E_CACHE)

    const description = await backend.describe({ image, focus: 'Describe the logo and transcribe its text.' })

    console.info(description)
    expect(description.length).toBeGreaterThan(20)
    expect(description.trim().split(/\s+/).length).toBeGreaterThan(8)
    expect(description.toLowerCase()).not.toContain('vision unavailable')
  }, 30 * 60 * 1000)
})
