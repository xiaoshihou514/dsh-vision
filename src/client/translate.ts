/** Browser-side translation channel: image bytes in, evidence text out. @module dsh-vision/client/translate */

import type { ImageMediaType } from '@deepseek-ai/dsh-attachment'

/** Endpoint registered by the dsh-vision server plugin. */
export const UPLOAD_ENDPOINT = '/dsh-vision/vision'
/** Custom header the endpoint requires (cross-site preflight shield). */
export const UPLOAD_HEADER = 'x-dsh-vision'
/** Header value the server endpoint verifies. */
export const UPLOAD_HEADER_VALUE = 'dsh-vision'

/** One client-submitted translation request. */
export interface TranslatePayload {
  mediaType: ImageMediaType
  /** Base64-encoded image bytes. */
  data: string
  /** Optional display name surfaced to the evidence record. */
  name?: string
  /** Optional user text steering which visual details matter. */
  focus?: string
}

/** Translation outcome handed to the composer. */
export type TranslateResult = { ok: true; text: string } | { ok: false; error: string }

export interface TranslateOptions {
  endpoint?: string
  header?: string
  headerValue?: string
  fetch?: typeof fetch
}

/**
 * Post image bytes to the dsh-vision translation endpoint and read the
 * evidence text. The endpoint requires a custom header, which forces a CORS
 * preflight on cross-site browsers the endpoint never answers.
 * @param payload - media type, base64 bytes, and optional focus text.
 * @param options - endpoint/header overrides and the fetch implementation (tests).
 * @returns evidence text on success, or a user-facing error.
 */
export async function translateImage(payload: TranslatePayload, options: TranslateOptions = {}): Promise<TranslateResult> {
  const endpoint = options.endpoint ?? UPLOAD_ENDPOINT
  const header = options.header ?? UPLOAD_HEADER
  const headerValue = options.headerValue ?? UPLOAD_HEADER_VALUE
  try {
    const response = await (options.fetch ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [header]: headerValue,
      },
      body: JSON.stringify({
        mediaType: payload.mediaType,
        data: payload.data,
        ...payload.name === undefined || payload.name === '' ? {} : { name: payload.name },
        ...payload.focus === undefined || payload.focus === '' ? {} : { focus: payload.focus },
      }),
    })
    const body = await response.json() as { ok?: boolean; text?: string; error?: string }
    if (!response.ok || body.ok !== true || typeof body.text !== 'string' || body.text.length === 0) {
      return { ok: false, error: body.error ?? `translation failed (${response.status})` }
    }
    return { ok: true, text: body.text }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Read one browser file as a base64 data payload.
 * @param file - browser-selected image file.
 * @returns the base64-encoded bytes without the data-URL prefix.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('could not read the selected file'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma === -1 ? result : result.slice(comma + 1))
    }
    reader.onerror = () => reject(new Error('could not read the selected file'))
    reader.readAsDataURL(file)
  })
}

/** Whether a browser file's media type is accepted by the translation endpoint. */
export function supportedImageType(mediaType: string): mediaType is ImageMediaType {
  return mediaType === 'image/png' || mediaType === 'image/jpeg' || mediaType === 'image/webp' || mediaType === 'image/gif'
}

/** Session-prompt client narrowed to the plain-text submission the composer entry performs. */
export interface EvidenceSubmitter {
  sessions: {
    prompt(payload: {
      sessionId: unknown
      mode: 'queue'
      content: readonly { type: 'text'; text: string }[]
    }): Promise<{ ok: boolean; error?: { message: string } }>
  }
}

/**
 * Submit translated evidence as a plain-text message. Text-only content never
 * trips harness image admission, so any model on the session can answer.
 * @param api - host RPC client narrowed to message submission.
 * @param sessionId - owning session.
 * @param text - evidence text from the translation endpoint.
 * @returns submission outcome.
 */
export async function submitEvidence(
  api: EvidenceSubmitter,
  sessionId: unknown,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await api.sessions.prompt({
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text }],
    })
    if (!response.ok) return { ok: false, error: response.error?.message ?? '消息发送失败' }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
