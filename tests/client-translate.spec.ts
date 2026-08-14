import { describe, expect, it, vi } from 'vitest'
import {
  submitEvidence,
  supportedImageType,
  translateImage,
  UPLOAD_HEADER,
  UPLOAD_HEADER_VALUE,
} from '../src/client/translate.ts'
import type { EvidenceSubmitter } from '../src/client/translate.ts'
import { SessionId } from '@deepseek-ai/dsh-session'

describe('translateImage', () => {
  it('posts bytes to the endpoint and returns evidence text', async () => {
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { mediaType: string; data: string; focus?: string }
      expect(body).toMatchObject({ mediaType: 'image/png', data: 'AQID' })
      expect((init?.headers as Record<string, string>)[UPLOAD_HEADER]).toBe(UPLOAD_HEADER_VALUE)
      return new Response(JSON.stringify({ ok: true, text: 'Evidence text.' }), { status: 200 })
    })
    await expect(translateImage(
      { mediaType: 'image/png', data: 'AQID', focus: 'What is visible?' },
      { fetch: request as typeof fetch },
    )).resolves.toEqual({ ok: true, text: 'Evidence text.' })
  })

  it('surfaces endpoint errors', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403 }))
    await expect(translateImage(
      { mediaType: 'image/png', data: 'AQID' },
      { fetch: request as typeof fetch },
    )).resolves.toEqual({ ok: false, error: 'forbidden' })
  })

  it('rejects malformed responses', async () => {
    const request = vi.fn(async () => new Response('not json', { status: 200 }))
    const result = await translateImage({ mediaType: 'image/png', data: 'AQID' }, { fetch: request as typeof fetch })
    expect(result.ok).toBe(false)
  })

  it('contains only supported raster media types', () => {
    expect(supportedImageType('image/png')).toBe(true)
    expect(supportedImageType('image/jpeg')).toBe(true)
    expect(supportedImageType('image/webp')).toBe(true)
    expect(supportedImageType('image/gif')).toBe(true)
    expect(supportedImageType('image/svg+xml')).toBe(false)
    expect(supportedImageType('text/plain')).toBe(false)
  })
})

describe('submitEvidence', () => {
  it('submits text-only content in queue mode', async () => {
    const prompt = vi.fn(async (payload: unknown) => {
      expect(payload).toMatchObject({
        mode: 'queue',
        content: [{ type: 'text', text: 'Evidence text.' }],
      })
      return { rpcId: 'test', result: { ok: true, value: { accepted: true } } }
    })
    const api = { sessions: { prompt } } as unknown as EvidenceSubmitter
    await expect(submitEvidence(api, SessionId('session-id'), 'Evidence text.')).resolves.toEqual({ ok: true })
  })

  it('reports submission failures', async () => {
    const api = {
      sessions: {
        prompt: vi.fn(async () => ({ rpcId: 'test', result: { ok: false, error: { code: 'busy', message: 'agent busy' } } })),
      },
    } as unknown as EvidenceSubmitter
    await expect(submitEvidence(api, SessionId('session-id'), 'text')).resolves.toEqual({ ok: false, error: 'agent busy' })
  })
})
