import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { VisionBackend } from '../src/backend.ts'
import type { VisionBackendRequest } from '../src/backend.ts'
import * as VisionTool from '../src/vision-tool.ts'

class FakeVisionBackend extends VisionBackend {
  readonly model = 'fake-vision'
  readonly promptVersion = 'fake-v1'
  request: VisionBackendRequest | undefined

  describe(request: VisionBackendRequest): Promise<string> {
    this.request = request
    return Promise.resolve('The mock backend received the image.')
  }
}

describe('view_image tool', () => {
  it('reads a workspace image and returns backend text to a text-only caller', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(FakeVisionBackend)
    await ctx.plugin(VisionTool)
    const backend = ctx.visionBackend as FakeVisionBackend

    expect(ctx.tools.schemas().find(tool => tool.name === 'view_image')).toMatchObject({
      description: expect.stringContaining('text-only DeepSeek'),
    })
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('vision-call'),
      name: 'view_image',
      arguments: { file_path: 'assets/logo.png', question: 'What is visible?' },
      agent: { session: { header: { cwd: process.cwd() } } } as never,
    })

    expect(result).toMatchObject({
      isError: false,
      content: [{ type: 'text', text: 'The mock backend received the image.' }],
    })
    expect(backend.request).toMatchObject({
      image: { ref: { mediaType: 'image/png', bytes: expect.any(Number) } },
      focus: 'What is visible?',
    })
    expect(backend.request?.image.data.byteLength).toBeGreaterThan(0)
    const prompt = await ctx.systemPrompt.assemble()
    expect(prompt.sections.some(section => section.name === 'tool:dsh-vision')).toBe(true)
    await ctx.fiber.dispose()
  })
})
