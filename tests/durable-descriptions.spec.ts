import { Context } from '@deepseek-ai/cordis'
import type { StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionStore } from '@deepseek-ai/dsh-session'
import { describe, expect, it, vi } from 'vitest'
import type { VisionBackend } from '../src/backend.ts'
import {
  descriptionCacheKey,
  DurableVisionDescriptionStore,
} from '../src/durable-descriptions.ts'
import { isVisionMessageSource } from '../src/descriptions.ts'

const image = {
  ref: {
    attachmentId: 'sha256:image-one',
    mediaType: 'image/png',
    bytes: 4,
    width: 320,
    height: 200,
    name: 'chart.png',
  },
  data: new Uint8Array([1, 2, 3, 4]),
} as StoredImageAttachment

function fixture(describe = vi.fn(async () => 'A chart rising from 10 to 20.')): {
  store: DurableVisionDescriptionStore
  session: Session
  describe: typeof describe
} {
  const context = new Context()
  const session = Session.create(SessionId('session-one'))
  const sessions = { get: (id: string) => id === session.id ? session : undefined } as unknown as SessionStore
  const backend = {
    model: 'local-vlm-q4',
    promptVersion: 'observe-v1',
    describe,
  } as unknown as VisionBackend
  return {
    store: new DurableVisionDescriptionStore(context, sessions, backend),
    session,
    describe,
  }
}

describe('DurableVisionDescriptionStore', () => {
  it('persists a core user message before returning visual evidence', async () => {
    const { store, session } = fixture()
    const result = await store.resolve({ sessionId: session.id, image })

    expect(result).toMatchObject({
      cacheKey: descriptionCacheKey('sha256:image-one', 'local-vlm-q4', 'observe-v1'),
      text: 'A chart rising from 10 to 20.',
    })
    const event = session.events.at(-1)
    expect(event).toMatchObject({
      type: 'user/message',
      surfaceOp: 'append',
      data: { content: [{ type: 'text', text: result.text }] },
    })
    expect(event?.type === 'user/message' && isVisionMessageSource(event.data.source)).toBe(true)
  })

  it('reuses the persisted description without running inference again', async () => {
    const first = fixture()
    const result = await first.store.resolve({ sessionId: first.session.id, image })
    const replayed = Session.create(SessionId('session-one'), first.session.events)
    const describe = vi.fn(async () => 'must not run')
    const context = new Context()
    const sessions = { get: () => replayed } as unknown as SessionStore
    const backend = { model: result.model, promptVersion: result.promptVersion, describe } as unknown as VisionBackend
    const store = new DurableVisionDescriptionStore(context, sessions, backend)

    await expect(store.resolve({ sessionId: replayed.id, image })).resolves.toEqual(result)
    expect(describe).not.toHaveBeenCalled()
  })

  it('keeps focused evidence distinct for different questions about the same image', async () => {
    const describe = vi.fn(async ({ focus }: { focus?: string }) => `Evidence for ${focus}`)
    const { store, session } = fixture(describe)

    const revenue = await store.resolve({ sessionId: session.id, image, focus: 'What is revenue?' })
    const colors = await store.resolve({ sessionId: session.id, image, focus: 'What colors are used?' })
    const revenueReplay = await store.resolve({ sessionId: session.id, image, focus: '  What   is revenue?  ' })

    expect(revenue.cacheKey).not.toBe(colors.cacheKey)
    expect(revenueReplay).toEqual(revenue)
    expect(describe).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent inference for the same session and derivation', async () => {
    let finish: ((text: string) => void) | undefined
    const describe = vi.fn(() => new Promise<string>(resolve => finish = resolve))
    const { store, session } = fixture(describe)

    const first = store.resolve({ sessionId: session.id, image })
    const second = store.resolve({ sessionId: session.id, image })
    expect(describe).toHaveBeenCalledTimes(1)
    finish?.('One shared description.')

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ text: 'One shared description.' }),
      expect.objectContaining({ text: 'One shared description.' }),
    ])
    expect(session.events.filter(event => event.type === 'user/message')).toHaveLength(1)
  })

  it('aborts the backend after every waiter cancels', async () => {
    const describe = vi.fn(({ signal }: { signal?: AbortSignal }) => new Promise<string>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const { store, session } = fixture(describe)
    const firstController = new AbortController()
    const secondController = new AbortController()
    const first = store.resolve({ sessionId: session.id, image }, firstController.signal)
    const second = store.resolve({ sessionId: session.id, image }, secondController.signal)

    firstController.abort(new Error('first cancelled'))
    await expect(first).rejects.toThrow('first cancelled')
    expect(describe.mock.calls[0]?.[0].signal?.aborted).toBe(false)
    secondController.abort(new Error('second cancelled'))
    await expect(second).rejects.toThrow('second cancelled')
    expect(describe.mock.calls[0]?.[0].signal?.aborted).toBe(true)
    expect(session.events).toHaveLength(0)
  })

  it('rejects empty backend output without appending a message', async () => {
    const { store, session } = fixture(vi.fn(async () => '  '))
    await expect(store.resolve({ sessionId: session.id, image })).rejects.toThrow('empty description')
    expect(session.events).toHaveLength(0)
  })
})
