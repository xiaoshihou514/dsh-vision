import { Context } from '@deepseek-ai/cordis'
import type { StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { CredentialProvider, credentialRef } from '@deepseek-ai/dsh-credentials'
import type {
  CredentialKey,
  CredentialRecord,
  CredentialRecordEntry,
  CredentialRecordInfo,
} from '@deepseek-ai/dsh-credentials'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { glmVisionChat } from '../src/glm-backend.ts'
import { QwenVisionBackend } from '../src/qwen-backend.ts'

const image = {
  ref: { attachmentId: 'sha256:test', mediaType: 'image/png', bytes: 3, width: 1, height: 1 },
  data: new Uint8Array([1, 2, 3]),
} as StoredImageAttachment

class MemoryCredentials extends CredentialProvider {
  value = 'stored-key'
  private records = new Map<CredentialKey, CredentialRecord>()

  resolve(): Promise<{ value: string; source: string }> {
    return Promise.resolve({ value: this.value, source: 'memory' })
  }

  describe(): Promise<{ configured: boolean; source: string; writable: boolean }> {
    return Promise.resolve({ configured: true, source: 'memory', writable: true })
  }

  set(_ref: ReturnType<typeof credentialRef>, value: string): Promise<void> {
    this.value = value
    return Promise.resolve()
  }

  unset(): Promise<void> {
    this.value = ''
    return Promise.resolve()
  }

  readRecord(key: CredentialKey): Promise<CredentialRecord | undefined> {
    return Promise.resolve(this.records.get(key))
  }

  describeRecord(key: CredentialKey): Promise<CredentialRecordInfo> {
    const record = this.records.get(key)
    return Promise.resolve({
      configured: record !== undefined,
      ...(record === undefined ? {} : { kind: record.kind }),
      writable: true,
    })
  }

  listRecords(): Promise<readonly CredentialRecordEntry[]> {
    return Promise.resolve(
      [...this.records.entries()].map(([key, record]) => ({ key, kind: record.kind })),
    )
  }

  modifyRecord(
    key: CredentialKey,
    mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined> {
    return mutate(this.records.get(key)).then((next) => {
      if (next === undefined) return this.records.get(key)
      this.records.set(key, next)
      return next
    })
  }

  deleteRecord(key: CredentialKey): Promise<void> {
    this.records.delete(key)
    return Promise.resolve()
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('glmVisionChat', () => {
  it('sends an OpenAI-compatible inline image request and strips reasoning', async () => {
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ image_url?: { url: string } }> }> }
      expect(body.messages[0]?.content[0]?.image_url?.url).toBe('data:image/png;base64,AQID')
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer secret-value')
      return new Response(JSON.stringify({ choices: [{ message: { content: '<think>private</think>Visible evidence' } }] }))
    })
    await expect(glmVisionChat({
      baseURL: 'https://example.test/v1/', apiKey: 'secret-value', model: 'glm-test',
      maxTokens: 64, timeoutMs: 1000, image, prompt: 'Inspect it', fetch: request as typeof fetch,
    })).resolves.toBe('Visible evidence')
  })

  it('redacts credentials from endpoint errors', async () => {
    const request = vi.fn(async () => new Response('bad secret-value', { status: 401 }))
    await expect(glmVisionChat({
      baseURL: 'https://example.test/v1', apiKey: 'secret-value', model: 'glm-test',
      maxTokens: 64, timeoutMs: 1000, image, prompt: 'Inspect it', fetch: request as typeof fetch,
    })).rejects.not.toThrow('secret-value')
  })
})

describe('GLM-backed vision service', () => {
  it('resolves the key saved by the Harness credential service', async () => {
    const ctx = new Context()
    await ctx.plugin(MemoryCredentials).await()
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(String((init?.headers as Record<string, string>).authorization))
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Stored-key evidence' } }] }))
    }))
    const backend = new QwenVisionBackend(ctx, { backend: 'glm' })

    await expect(backend.describe({ image })).resolves.toBe('Stored-key evidence')
    await ctx.credentials.set(credentialRef('ZHIPUAI_API_KEY'), 'rotated-key')
    await expect(backend.describe({ image })).resolves.toBe('Stored-key evidence')

    expect(requests).toEqual(['Bearer stored-key', 'Bearer rotated-key'])
    await ctx.fiber.dispose()
  })

  it('uses the free fallback chain on rate limiting', async () => {
    vi.stubEnv('ZHIPUAI_API_KEY', 'test-key')
    const models: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string }
      models.push(body.model)
      if (models.length === 1) return new Response('busy', { status: 429 })
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Fallback evidence' } }] }))
    }))
    const backend = new QwenVisionBackend(new Context(), { backend: 'glm' })
    await expect(backend.describe({ image })).resolves.toBe('Fallback evidence')
    expect(models).toEqual(['glm-4.6v-flash', 'glm-4.1v-thinking-flash'])
    expect(backend.model).toBe('glm-4.6v-flash:max2048')
    expect(backend.promptVersion).toBe('glm-evidence-v1')
  })
})
