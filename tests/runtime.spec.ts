import { describe, expect, it } from 'vitest'

describe('packaged inference runtime', () => {
  it('loads without a system Python or model server', async () => {
    const runtime = await import('@huggingface/transformers')

    expect(runtime.Florence2ForConditionalGeneration).toBeTypeOf('function')
    expect(runtime.RawImage).toBeTypeOf('function')
  })
})
