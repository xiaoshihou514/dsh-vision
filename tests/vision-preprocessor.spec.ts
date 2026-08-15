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
  it('replaces image blocks with evidence while preserving message identity and text order', async () => {
    const image: StoredImageAttachment = {
      ref,
      data: new Uint8Array([1, 2, 3, 4]),
    }
    const readImage = vi.fn(async () => image)
    const describe = vi.fn(async () => 'A small blue square.')
    const message = createUserMessage({
      source: { kind: 'plugin', plugin: 'dsh-weixin' },
      content: [
        { type: 'text', text: 'What is shown here?' },
        { type: 'image', attachment: ref },
      ],
    })

    const [rewritten] = await transcribeImages(
      { readImage } as unknown as AttachmentStore,
      { describe } as unknown as VisionBackend,
      [message],
      new AbortController().signal,
    )

    expect(rewritten).toMatchObject({
      id: message.id,
      role: 'user',
      source: message.source,
    })
    expect(rewritten?.content).toEqual([
      { type: 'text', text: 'What is shown here?' },
      {
        type: 'text',
        text: '[Image evidence: sample.png]\nA small blue square.',
      },
    ])
    expect(message.content[1]).toEqual({ type: 'image', attachment: ref })
    expect(readImage).toHaveBeenCalledWith(ref, expect.any(AbortSignal))
    expect(describe).toHaveBeenCalledWith(
      expect.objectContaining({
        image,
        focus: 'What is shown here?',
      }),
    )
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
