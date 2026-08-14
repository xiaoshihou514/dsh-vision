/** OpenAI-compatible remote vision transport, defaulting to Zhipu GLM's free tier. */

import type { StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { Buffer } from 'node:buffer'

export const DEFAULT_GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
export const DEFAULT_GLM_MODEL = 'glm-4.6v-flash'
export const DEFAULT_GLM_FALLBACK_MODELS = ['glm-4.1v-thinking-flash', 'glm-4v-flash'] as const

export interface GlmVisionRequest {
  baseURL: string
  apiKey: string
  model: string
  maxTokens: number
  timeoutMs: number
  image: StoredImageAttachment
  prompt: string
  signal?: AbortSignal
  fetch?: typeof fetch
}

export class GlmVisionHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function extractText(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return undefined
  const content = (choices[0] as { message?: { content?: unknown } }).message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return undefined
  const parts = content.flatMap((part) => {
    if (typeof part !== 'object' || part === null) return []
    const text = (part as { text?: unknown }).text
    return typeof text === 'string' ? [text] : []
  })
  return parts.length === 0 ? undefined : parts.join('\n')
}

function stripThinking(text: string): string {
  const closed = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  if (closed !== text) return closed.trim()
  return /^\s*<think>/.test(text) ? '' : text.trim()
}

/** Describe one already-verified attachment through an OpenAI-compatible VLM. */
export async function glmVisionChat(request: GlmVisionRequest): Promise<string> {
  const url = `${request.baseURL.replace(/\/$/, '')}/chat/completions`
  const imageUrl = `data:${request.image.ref.mediaType};base64,${Buffer.from(request.image.data).toString('base64')}`
  const signals = [AbortSignal.timeout(request.timeoutMs), ...request.signal === undefined ? [] : [request.signal]]
  const redact = (value: string): string => request.apiKey === '' ? value : value.replaceAll(request.apiKey, '***')
  let response: Response
  try {
    response = await (request.fetch ?? fetch)(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...request.apiKey === '' ? {} : { authorization: `Bearer ${request.apiKey}` },
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: request.prompt },
        ] }],
      }),
      signal: AbortSignal.any(signals),
    })
  } catch (error) {
    throw new Error(redact(`GLM vision request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`))
  }
  const body = await response.text()
  if (!response.ok) {
    throw new GlmVisionHttpError(redact(`GLM vision returned ${response.status}: ${body.slice(0, 500)}`), response.status)
  }
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    throw new Error(`GLM vision returned non-JSON content: ${body.slice(0, 200)}`)
  }
  const text = extractText(payload)
  if (text === undefined) throw new Error(`GLM vision returned no assistant text: ${body.slice(0, 300)}`)
  const cleaned = stripThinking(text)
  if (cleaned === '') throw new Error('GLM vision returned only reasoning; raise the output-token limit')
  return cleaned
}
