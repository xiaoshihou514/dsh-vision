import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_NEW_TOKENS,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_REVISION,
  DEFAULT_TASK,
  TransformersVisionBackend,
} from '../src/transformers-backend.ts'

const imagePath = process.env.DSH_VISION_E2E_IMAGE
const run = imagePath === undefined ? describe.skip : describe

run('TransformersVisionBackend end to end', () => {
  it('describes an image with the pinned local model', async () => {
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
    const backend = new TransformersVisionBackend(new Context(), {
      modelId: DEFAULT_MODEL_ID,
      revision: DEFAULT_MODEL_REVISION,
      dtype: 'q4',
      cacheDir: process.env.DSH_VISION_E2E_CACHE ?? '.cache/e2e-models',
      maxNewTokens: DEFAULT_MAX_NEW_TOKENS,
      task: DEFAULT_TASK,
      includeOcr: true,
    })

    const description = await backend.describe({ image })

    console.info(description)
    expect(description.length).toBeGreaterThan(10)
  }, 10 * 60 * 1000)
})
