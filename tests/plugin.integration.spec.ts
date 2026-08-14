import { Context } from '@deepseek-ai/cordis'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionStore } from '@deepseek-ai/dsh-session'
import { describe, expect, it, vi } from 'vitest'
import { VisionAdapter } from '../src/adapter.ts'
import { VisionBackend } from '../src/backend.ts'
import { DurableVisionDescriptionStore } from '../src/durable-descriptions.ts'

const attachment = {
  attachmentId: 'sha256:dashboard',
  mediaType: 'image/png',
  bytes: 4,
  width: 800,
  height: 600,
  name: 'dashboard.png',
} as ImageAttachmentRef

async function consume(stream: AsyncIterable<StreamChunk>): Promise<void> {
  for await (const _chunk of stream) { /* consume */ }
}

describe('composed vision bridge', () => {
  it('persists focused evidence before downstream dispatch and reuses it on replay', async () => {
    const ctx = new Context()
    const session = Session.create(SessionId('vision-session'))
    const sessions = { get: () => session } as unknown as SessionStore
    const describe = vi.fn(async ({ focus }: { focus?: string }) =>
      `The lower-right value is 42. Focus: ${focus}`)
    const backend = new class extends VisionBackend {
      readonly model = 'qwen-test:q4'
      readonly promptVersion = 'evidence-v1'
      override describe = describe
    }(ctx)
    const descriptions = new DurableVisionDescriptionStore(ctx, sessions, backend)
    const downstream: GenerateOptions[] = []
    const adapter = new VisionAdapter({
      provider: 'dsh-vision',
      displayName: 'DeepSeek with local vision',
      downstreamProvider: 'deepseek-official',
      downstreamModel: 'deepseek-v4-flash',
      attachments: {
        readImage: vi.fn(async () => ({ ref: attachment, data: new Uint8Array([1, 2, 3, 4]) })),
      } as unknown as AttachmentStore,
      descriptions,
      stream: options => {
        downstream.push(options)
        return (async function* (): AsyncIterable<StreamChunk> {
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
    })
    const options = {
      provider: 'dsh-vision',
      model: 'deepseek-v4-flash',
      sessionId: session.id,
      messages: [{
        id: 'image-turn',
        role: 'user',
        source: { kind: 'user' },
        content: [
          { type: 'image', attachment },
          { type: 'text', text: 'What is the lower-right value?' },
        ],
      }],
    } as GenerateOptions

    await consume(adapter.stream(options))
    expect(session.events).toHaveLength(1)
    expect(describe).toHaveBeenCalledWith(expect.objectContaining({
      focus: 'What is the lower-right value?',
    }))
    expect(downstream[0]).toMatchObject({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
    })
    expect(JSON.stringify(downstream[0]?.messages)).toContain('The lower-right value is 42')
    expect(JSON.stringify(downstream[0]?.messages)).not.toContain('"type":"image"')

    await consume(adapter.stream(options))
    expect(describe).toHaveBeenCalledTimes(1)
    expect(session.events).toHaveLength(1)
    expect(downstream).toHaveLength(2)
  })
})
