import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import { VisionAdapter } from '../src/adapter.ts'
import type { VisionDescriptionStore } from '../src/descriptions.ts'

const attachment = {
  attachmentId: 'sha256:image-one',
  mediaType: 'image/png',
  bytes: 4,
  width: 640,
  height: 480,
  name: 'diagram.png',
} as ImageAttachmentRef

function request(sessionId: string | null = 'session-one'): GenerateOptions {
  return {
    provider: 'dsh-vision',
    model: 'deepseek-chat',
    messages: [{
      id: 'message-one',
      role: 'user',
      source: { kind: 'user' },
      content: [
        { type: 'text', text: 'Explain this diagram.' },
        { type: 'image', attachment },
      ],
    }],
    ...sessionId === null ? {} : { sessionId },
  } as GenerateOptions
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

function adapter(captured: GenerateOptions[]): {
  adapter: VisionAdapter
  readImage: ReturnType<typeof vi.fn>
  resolve: ReturnType<typeof vi.fn>
} {
  const readImage = vi.fn(async () => ({ ref: attachment, data: new Uint8Array([1, 2, 3, 4]) }))
  const resolve = vi.fn(async () => ({
    attachment,
    model: 'local-vlm-q4',
    promptVersion: 'observe-v1',
    text: 'A three-node directed graph with A pointing to B and C.',
  }))
  return {
    adapter: new VisionAdapter({
      provider: 'dsh-vision',
      displayName: 'DeepSeek + local vision',
      downstreamProvider: 'deepseek',
      downstreamModel: 'deepseek-chat',
      stream: (options) => {
        captured.push(options)
        return (async function* (): AsyncIterable<StreamChunk> {
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
      attachments: { readImage } as unknown as AttachmentStore,
      descriptions: { resolve } as unknown as VisionDescriptionStore,
    }),
    readImage,
    resolve,
  }
}

describe('VisionAdapter', () => {
  it('advertises image input and delegates a text-only cloned request', async () => {
    const captured: GenerateOptions[] = []
    const fixture = adapter(captured)

    expect(await fixture.adapter.listModels('dsh-vision')).toMatchObject([{
      provider: 'dsh-vision',
      id: 'deepseek-chat',
      inputModalities: ['text', 'image'],
    }])
    expect(await collect(fixture.adapter.stream(request()))).toEqual([
      { type: 'finish', reason: { kind: 'stop' } },
    ])

    expect(fixture.readImage).toHaveBeenCalledWith(attachment, undefined)
    expect(fixture.resolve).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-one',
      image: expect.objectContaining({ ref: attachment }),
    }), undefined)
    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({ provider: 'deepseek', model: 'deepseek-chat' })
    expect(captured[0]?.messages[0]?.content).toEqual([
      { type: 'text', text: 'Explain this diagram.' },
      {
        type: 'text',
        text: expect.stringContaining('A three-node directed graph with A pointing to B and C.'),
      },
    ])
    expect(request().messages[0]?.content[1]).toEqual({ type: 'image', attachment })
  })

  it('refuses image inference without a durable owning session', async () => {
    const fixture = adapter([])
    const consume = async (): Promise<void> => {
      await collect(fixture.adapter.stream(request(null)))
    }

    await expect(consume()).rejects.toMatchObject({ code: 'VISION_SESSION_REQUIRED' })
    expect(fixture.readImage).not.toHaveBeenCalled()
    expect(fixture.resolve).not.toHaveBeenCalled()
  })

  it('refuses recursive downstream routing at construction', () => {
    expect(() => new VisionAdapter({
      provider: 'same',
      displayName: 'same',
      downstreamProvider: 'same',
      downstreamModel: 'model',
      stream: () => (async function* (): AsyncIterable<StreamChunk> {})(),
      attachments: {} as AttachmentStore,
      descriptions: {} as VisionDescriptionStore,
    })).toThrow(expect.objectContaining({ code: 'VISION_RECURSIVE_ROUTE' }))
  })

  it('filters persisted vision messages from downstream history', async () => {
    const captured: GenerateOptions[] = []
    const fixture = adapter(captured)
    const options = request()
    options.messages.push({
      id: 'description-message',
      role: 'user',
      content: [{ type: 'text', text: 'persisted description' }],
      source: {
        kind: 'vision',
        plugin: 'dsh-vision',
        cacheKey: 'cache',
        attachment,
        model: 'local-vlm-q4',
        promptVersion: 'observe-v1',
      },
    } as never)

    await collect(fixture.adapter.stream(options))
    expect(captured[0]?.messages).toHaveLength(1)
    expect(captured[0]?.messages.some(message => message.source.kind === 'vision')).toBe(false)
  })
})
