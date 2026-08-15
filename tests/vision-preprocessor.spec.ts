import {
  AttachmentId,
  type AttachmentStore,
  type StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import type { VisionBackend } from '../src/backend.ts'
import { transcribeImages } from '../src/vision-preprocessor.ts'

const ref = {
  attachmentId: AttachmentId('image-1'),
  mediaType: 'image/png' as const,
  bytes: 4,
  width: 1,
  height: 1,
  name: 'sample.png',
}

describe('image message preprocessing', () => {
  it('keeps user text visible and moves evidence to collapsed plugin context', async () => {
    const image: StoredImageAttachment = {
      ref,
      data: new Uint8Array([1, 2, 3, 4]),
    }
    const readImage = vi.fn(async () => image)
    const describe = vi.fn(async () => 'A small blue square.')
    const message = createUserMessage({
      source: { kind: 'user' },
      content: [
        { type: 'text', text: 'What is shown here?' },
        { type: 'image', attachment: ref },
      ],
    })

    const rewritten = await transcribeImages(
      { readImage } as unknown as AttachmentStore,
      { describe } as unknown as VisionBackend,
      [message],
      new AbortController().signal,
    )

    expect(rewritten).toHaveLength(2)
    expect(rewritten[0]).toMatchObject({
      id: message.id,
      role: 'user',
      source: message.source,
    })
    expect(rewritten[0]?.content).toEqual([
      { type: 'text', text: 'What is shown here?' },
    ])
    expect(rewritten[1]).toMatchObject({
      role: 'user',
      source: {
        kind: 'plugin',
        plugin: 'dsh-vision',
        form: 'notice',
        summary: '已读取 1 张图片',
      },
      content: [
        { type: 'text', text: '[Image: sample.png]\nA small blue square.' },
      ],
    })
    expect(
      rewritten
        .flatMap((item) => item.content)
        .some((block) => block.type === 'image'),
    ).toBe(false)
    expect(message.content[1]).toEqual({ type: 'image', attachment: ref })
    expect(readImage).toHaveBeenCalledWith(ref, expect.any(AbortSignal))
    expect(describe).toHaveBeenCalledWith(
      expect.objectContaining({
        image,
        focus: 'What is shown here?',
      }),
    )
  })

  it('leaves a small visible marker for an image-only native prompt', async () => {
    const image: StoredImageAttachment = { ref, data: new Uint8Array([1]) }
    const message = createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'image', attachment: ref }],
    })

    const rewritten = await transcribeImages(
      { readImage: async () => image } as unknown as AttachmentStore,
      { describe: async () => 'A square.' } as unknown as VisionBackend,
      [message],
      new AbortController().signal,
    )

    expect(rewritten[0]?.content).toEqual([
      { type: 'text', text: '图片已识别：sample.png' },
    ])
    expect(rewritten[1]?.content).toEqual([
      { type: 'text', text: '[Image: sample.png]\nA square.' },
    ])
  })

  it('leaves text-only messages untouched', async () => {
    const message = createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'text', text: 'hello' }],
    })
    const describe = vi.fn()

    const [unchanged] = await transcribeImages(
      {} as AttachmentStore,
      { describe } as unknown as VisionBackend,
      [message],
      new AbortController().signal,
    )

    expect(unchanged).toBe(message)
    expect(describe).not.toHaveBeenCalled()
  })
})
