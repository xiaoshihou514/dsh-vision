import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'

describe('vision settings registration', () => {
  it('exposes its settings namespace through the model directory', () => {
    const registerConfigurableProviders = vi.fn()
    const registerAdapter = vi.fn()
    const ctx = {
      attachments: {},
      visionDescriptions: {},
      llm: {
        stream: vi.fn(),
        registerAdapter,
        registerConfigurableProviders,
      },
    } as unknown as Context

    apply(ctx, {
      downstreamProvider: 'deepseek-official',
      downstreamModel: 'deepseek-chat',
    })

    expect(registerConfigurableProviders).toHaveBeenCalledWith([{
      provider: 'dsh-vision',
      displayName: 'DeepSeek + local vision',
      settingsNs: 'dsh-vision',
      settingsPath: [],
    }])
    expect(registerAdapter).toHaveBeenCalledOnce()
  })
})
