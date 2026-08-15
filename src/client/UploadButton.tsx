/** Composer tool-row entry: pick an image, translate it, send the evidence as text. @module dsh-vision/client/UploadButton */

import { useRef, useState, type CSSProperties } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-session'
import {
  fileToBase64,
  submitEvidence,
  supportedImageType,
  translateImage,
} from './translate.ts'

/** Business face injected into the composer entry. */
export interface ComposerBlocks {
  set(sessionId: SessionId, block: { reason: string } | undefined): void
  storeFor(sessionId: SessionId): {
    getSnapshot(): { reason: string } | undefined
  }
}

export interface UploadButtonInjected {
  /** Host RPC client narrowed to message submission. */
  api: Pick<IApiClient, 'sessions'>
  /** Owning session; the translated evidence is submitted as a plain-text message. */
  sessionId: SessionId
  /** Native composer gate shared with the send button and Enter shortcut. */
  blocks: ComposerBlocks
}

const ALLOWED_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'
const LABEL = '上传图片并识别'
export const TRANSCRIBING = '正在识别图片，请稍候'

export function beginTranscription(
  blocks: ComposerBlocks,
  sessionId: SessionId,
): string | undefined {
  const blocked = blocks.storeFor(sessionId).getSnapshot()
  if (blocked !== undefined) return blocked.reason
  blocks.set(sessionId, { reason: TRANSCRIBING })
  return undefined
}

export function endTranscription(
  blocks: ComposerBlocks,
  sessionId: SessionId,
): void {
  if (blocks.storeFor(sessionId).getSnapshot()?.reason === TRANSCRIBING) {
    blocks.set(sessionId, undefined)
  }
}

const control: CSSProperties = {
  appearance: 'none',
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  width: 28,
  height: 28,
  padding: 0,
  border: 0,
  borderRadius: 999,
  color: 'var(--dsw-alias-label-primary)',
  cursor: 'pointer',
}

function PaperclipIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.55 9.75V5h1.4v4.75a1.05 1.05 0 0 0 2.1 0V4.5a2.8 2.8 0 0 0-5.6 0v5.25a4.55 4.55 0 0 0 9.1 0V4h1.4v5.75a5.95 5.95 0 0 1-11.9 0V4.5a4.2 4.2 0 0 1 8.4 0v5.25a2.45 2.45 0 0 1-4.9 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

function LoadingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.13 13.13a7.25 7.25 0 1 1 0-10.26l-.99.99a5.85 5.85 0 1 0 0 8.28Z"
        fill="currentColor"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 8 8"
          to="360 8 8"
          dur=".8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  )
}

/**
 * The "upload and recognize image" control: the selected file is translated
 * through the dsh-vision HTTP endpoint and its evidence is submitted as a
 * text-only message, so the harness image admission never applies — any model
 * on the session can answer.
 * @param props - injected api and session identity.
 */
export function UploadButton({ api, sessionId, blocks }: UploadButtonInjected) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [focused, setFocused] = useState(false)

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    if (!supportedImageType(file.type)) {
      setError('仅支持 PNG、JPEG、WebP 与 GIF 图片')
      return
    }
    const blockedReason = beginTranscription(blocks, sessionId)
    if (blockedReason !== undefined) {
      setError(blockedReason)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await fileToBase64(file)
      const result = await translateImage({
        mediaType: file.type,
        data,
        ...(file.name === '' ? {} : { name: file.name }),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const response = await submitEvidence(api, sessionId, result.text)
      if (!response.ok) setError(response.error)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      endTranscription(blocks, sessionId)
      setBusy(false)
      if (inputRef.current !== null) inputRef.current.value = ''
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onPointerEnter={() => {
          setActive(true)
        }}
        onPointerLeave={() => {
          setActive(false)
        }}
        onFocus={() => {
          setFocused(true)
        }}
        onBlur={() => {
          setFocused(false)
        }}
        aria-label={busy ? '正在识别图片' : LABEL}
        title={busy ? '正在识别图片' : LABEL}
        style={{
          ...control,
          background:
            active && !busy
              ? 'var(--dsw-alias-interactive-bg-hover-solid)'
              : 'var(--dsw-specific-selector)',
          opacity: busy ? 0.5 : 1,
          cursor: busy ? 'default' : 'pointer',
          outline: focused
            ? '2px solid var(--dsw-alias-state-business-primary)'
            : 'none',
          outlineOffset: 1,
        }}
      >
        {busy ? <LoadingIcon /> : <PaperclipIcon />}
      </button>
      {error !== null ? (
        <span
          role="status"
          aria-label={error}
          title={error}
          style={{
            display: 'grid',
            placeItems: 'center',
            color: 'var(--dsw-alias-label-error)',
            cursor: 'help',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 1.25a6.75 6.75 0 1 0 0 13.5A6.75 6.75 0 0 0 8 1.25Zm-.75 3h1.5v5h-1.5v-5Zm0 6.25h1.5V12h-1.5v-1.5Z"
              fill="currentColor"
            />
          </svg>
        </span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_ACCEPT}
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
        }}
      />
    </span>
  )
}
