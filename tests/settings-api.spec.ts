import { describe, expect, it, vi } from 'vitest'
import { apply, type WebRouteShape } from '../src/settings-api.ts'

describe('vision settings API', () => {
  it('serves the settings card independently of image upload', async () => {
    let route: WebRouteShape | undefined
    const describe = vi.fn(() => [
      { ns: 'dsh-vision', value: { backend: 'glm' } },
    ])
    apply({
      webServer: {
        register: (next: WebRouteShape) => {
          route = next
        },
      },
      settings: { describe },
      logger: () => ({ warn: vi.fn() }),
    } as never)

    const response = {
      status: 0,
      body: '',
      writeHead(status: number) {
        this.status = status
      },
      end(body: string) {
        this.body = body
      },
    }
    await route?.handler(
      {
        method: 'GET',
        headers: { 'x-dsh-vision': 'dsh-vision' },
      } as never,
      response as never,
    )

    expect(route?.path).toBe('/dsh-vision/settings')
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      value: { backend: 'glm' },
    })
    expect(describe).toHaveBeenCalledWith({ redactSecrets: true })
  })

  it('rejects requests without the same-origin guard header', async () => {
    let route: WebRouteShape | undefined
    apply({
      webServer: {
        register: (next: WebRouteShape) => {
          route = next
        },
      },
      settings: {},
      logger: () => ({ warn: vi.fn() }),
    } as never)
    const response = {
      status: 0,
      body: '',
      writeHead(status: number) {
        this.status = status
      },
      end(body: string) {
        this.body = body
      },
    }

    await route?.handler(
      { method: 'GET', headers: {} } as never,
      response as never,
    )

    expect(response.status).toBe(403)
  })
})
