/** Session-backed visual-description provider. @module dsh-vision/durable-descriptions */

import { Context } from '@deepseek-ai/cordis'
import { createHash } from 'node:crypto'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionId, SessionStore } from '@deepseek-ai/dsh-session'
import type { VisionBackend } from './backend.ts'
import {
  isVisionMessageSource,
  VisionDescriptionStore,
} from './descriptions.ts'
import type {
  VisionDescription,
  VisionDescriptionRequest,
  VisionMessageSource,
} from './descriptions.ts'

const PLUGIN = 'dsh-vision' as const

interface PendingDescription {
  controller: AbortController
  promise: Promise<VisionDescription>
  waiters: number
}

/** Stable cache key for one attachment under one backend derivation identity. */
export function descriptionCacheKey(
  attachmentId: string,
  model: string,
  promptVersion: string,
  focus?: string,
): string {
  const normalizedFocus = focus?.trim().replace(/\s+/g, ' ') ?? ''
  const focusDigest = createHash('sha256').update(normalizedFocus).digest('hex')
  return `${attachmentId}\u0000${model}\u0000${promptVersion}\u0000${focusDigest}`
}

function descriptionFromSession(session: Session, cacheKey: string): VisionDescription | undefined {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index]
    if (event?.type !== 'user/message' || !isVisionMessageSource(event.data.source)) continue
    if (event.data.source.cacheKey !== cacheKey) continue
    const text = event.data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
    if (text.length === 0) continue
    return {
      cacheKey,
      attachment: event.data.source.attachment,
      model: event.data.source.model,
      promptVersion: event.data.source.promptVersion,
      text,
    }
  }
  return undefined
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
}

/** Session-log implementation with per-session inference coalescing. */
export class DurableVisionDescriptionStore extends VisionDescriptionStore {
  private readonly pending = new Map<string, PendingDescription>()

  constructor(
    ctx: Context,
    private readonly sessions: SessionStore,
    private readonly backend: VisionBackend,
  ) {
    super(ctx)
  }

  override async resolve(request: VisionDescriptionRequest, signal?: AbortSignal): Promise<VisionDescription> {
    if (signal?.aborted) throw abortError(signal)
    const key = descriptionCacheKey(
      String(request.image.ref.attachmentId),
      this.backend.model,
      this.backend.promptVersion,
      request.focus,
    )
    const session = this.sessions.get(request.sessionId as SessionId)
    if (session === undefined) throw new Error(`dsh-vision session "${request.sessionId}" is not live`)
    const stored = descriptionFromSession(session, key)
    if (stored !== undefined) return stored

    const pendingKey = `${request.sessionId}\u0000${key}`
    let job = this.pending.get(pendingKey)
    if (job === undefined) {
      const controller = new AbortController()
      const promise = this.create(request, key, controller.signal)
      job = { controller, promise, waiters: 0 }
      this.pending.set(pendingKey, job)
      void promise.finally(() => this.pending.delete(pendingKey)).catch(() => undefined)
    }
    return this.wait(job, signal)
  }

  private async create(
    request: VisionDescriptionRequest,
    cacheKey: string,
    signal: AbortSignal,
  ): Promise<VisionDescription> {
    const text = (await this.backend.describe({
      image: request.image,
      ...request.focus === undefined ? {} : { focus: request.focus },
      signal,
    })).trim()
    if (text.length === 0) throw new Error('dsh-vision backend returned an empty description')
    const live = this.sessions.get(request.sessionId as SessionId)
    if (live === undefined) throw new Error(`dsh-vision session "${request.sessionId}" detached during inference`)
    const raced = descriptionFromSession(live, cacheKey)
    if (raced !== undefined) return raced
    const source: VisionMessageSource = {
      kind: 'vision',
      plugin: PLUGIN,
      cacheKey,
      attachment: request.image.ref,
      model: this.backend.model,
      promptVersion: this.backend.promptVersion,
    }
    live.append('user/message', createUserMessage({
      content: [{ type: 'text', text }],
      source,
    }), { surfaceOp: 'append' })
    return {
      cacheKey,
      attachment: request.image.ref,
      model: this.backend.model,
      promptVersion: this.backend.promptVersion,
      text,
    }
  }

  private wait(job: PendingDescription, signal?: AbortSignal): Promise<VisionDescription> {
    job.waiters += 1
    let settled = false
    const release = (): void => {
      if (settled) return
      settled = true
      job.waiters -= 1
      if (job.waiters === 0) job.controller.abort(new DOMException('All callers aborted', 'AbortError'))
    }
    if (signal === undefined) return job.promise.finally(release)
    return new Promise<VisionDescription>((resolve, reject) => {
      const aborted = (): void => {
        release()
        reject(abortError(signal))
      }
      signal.addEventListener('abort', aborted, { once: true })
      void job.promise.then(resolve, reject).finally(() => {
        signal.removeEventListener('abort', aborted)
        release()
      })
    })
  }
}

/** Cordis provider name. */
export const name = 'vision-descriptions'
/** Services required by the durable description provider. */
export const inject = ['sessions', 'visionBackend']

/** Mount the session-backed description service. */
export function apply(ctx: Context): void {
  new DurableVisionDescriptionStore(ctx, ctx.sessions, ctx.visionBackend)
}
