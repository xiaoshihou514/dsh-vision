import { EventEmitter } from 'node:events'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { VisionBackend } from '../src/backend.ts'
import type { VisionBackendRequest } from '../src/backend.ts'
import { apply, Config } from '../src/vision-upload.ts'
import type { WebRouteShape } from '../src/vision-upload.ts'

class FakeVisionBackend extends VisionBackend {
  readonly model = 'fake-vision'
  readonly promptVersion = 'fake-v1'
  calls: VisionBackendRequest[] = []

  async describe(request: VisionBackendRequest): Promise<string> {
    this.calls.push(request)
    return 'The dashboard shows revenue rising to 42.'
  }
}

interface RegisteredWebServer {
  route: WebRouteShape
}

function fixture(): { ctx: Context; server: RegisteredWebServer; backend: FakeVisionBackend } {
  const ctx = new Context()
  const backend = new FakeVisionBackend(ctx)
  const server: RegisteredWebServer = { route: undefined as never }
  Object.assign(ctx, {
    webServer: {
      register: (r: WebRouteShape): (() => void) => {
        server.route = r
        return () => undefined
      },
    },
  })
  apply(ctx, Config(undefined) as never)
  return { ctx, server, backend }
}

interface MockResponse {
  status: number
  body: unknown
  writeHead(status: number): void
  end(body?: string): void
}

function mockResponse(): MockResponse {
  const state = { status: 0, body: undefined as unknown }
  return {
    get status() { return state.status },
    get body() { return state.body },
    writeHead(status: number) { state.status = status },
    end(body?: string) { state.body = body === undefined ? undefined : JSON.parse(body) },
  }
}

function mockRequest(method: string, headers: Record<string, string>, payload: unknown): EventEmitter {
  const req = new EventEmitter() as EventEmitter & { method: string; headers: Record<string, string> }
  req.method = method
  req.headers = headers
  if (payload !== undefined) {
    const body = Buffer.from(JSON.stringify(payload))
    setImmediate(() => {
      req.emit('data', body)
      req.emit('end')
    })
  } else {
    setImmediate(() => req.emit('end'))
  }
  return req
}

async function invoke(server: RegisteredWebServer, req: EventEmitter, res: MockResponse): Promise<void> {
  await server.route.handler(req as never, res as never)
}

describe('vision upload endpoint', () => {
  it('translates a valid image and returns evidence text', async () => {
    const { server, backend } = fixture()
    const res = mockResponse()
    await invoke(server, mockRequest('POST', { 'x-dsh-vision': 'dsh-vision' }, {
      mediaType: 'image/png',
      data: Buffer.from([1, 2, 3, 4]).toString('base64'),
      name: 'chart.png',
      focus: 'What is the trend?',
    }), res)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, text: 'The dashboard shows revenue rising to 42.' })
    expect(backend.calls).toHaveLength(1)
    expect(backend.calls[0]?.image.ref).toMatchObject({ mediaType: 'image/png', name: 'chart.png' })
    expect(backend.calls[0]?.focus).toBe('What is the trend?')
  })

  it('rejects requests without the custom header', async () => {
    const { server, backend } = fixture()
    const res = mockResponse()
    await invoke(server, mockRequest('POST', {}, {
      mediaType: 'image/png',
      data: Buffer.from([1, 2, 3, 4]).toString('base64'),
    }), res)
    expect(res.status).toBe(403)
    expect(backend.calls).toHaveLength(0)
  })

  it('rejects non-POST methods', async () => {
    const { server } = fixture()
    const res = mockResponse()
    await invoke(server, mockRequest('GET', { 'x-dsh-vision': 'dsh-vision' }, undefined), res)
    expect(res.status).toBe(405)
  })

  it('rejects missing or oversized image data', async () => {
    const { server } = fixture()
    const missing = mockResponse()
    await invoke(server, mockRequest('POST', { 'x-dsh-vision': 'dsh-vision' }, {
      mediaType: 'image/png',
    }), missing)
    expect(missing.status).toBe(400)

    const huge = mockResponse()
    await invoke(server, mockRequest('POST', { 'x-dsh-vision': 'dsh-vision' }, {
      mediaType: 'image/png',
      data: Buffer.alloc(Config(undefined).maxImageBytes! + 1).toString('base64'),
    }), huge)
    expect(huge.status).toBe(400)
  })

  it('rejects unsupported media types', async () => {
    const { server } = fixture()
    const res = mockResponse()
    await invoke(server, mockRequest('POST', { 'x-dsh-vision': 'dsh-vision' }, {
      mediaType: 'image/svg+xml',
      data: Buffer.from('x').toString('base64'),
    }), res)
    expect(res.status).toBe(400)
  })

  it('fails closed when the backend returns empty evidence', async () => {
    const ctx = new Context()
    const backend = new class extends FakeVisionBackend {
      override async describe(): Promise<string> { return '   ' }
    }(ctx)
    const server: RegisteredWebServer = { route: undefined as never }
    Object.assign(ctx, {
      webServer: {
        register: (r: WebRouteShape): (() => void) => {
          server.route = r
          return () => undefined
        },
      },
    })
    apply(ctx, Config(undefined) as never)
    const res = mockResponse()
    await invoke(server, mockRequest('POST', { 'x-dsh-vision': 'dsh-vision' }, {
      mediaType: 'image/png',
      data: Buffer.from([1]).toString('base64'),
    }), res)
    expect(res.status).toBe(502)
  })
})
