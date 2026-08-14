/** Composer tool-row entry: pick an image, translate it, send the evidence as text. @module dsh-vision/client/UploadButton */

import { useRef, useState } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { fileToBase64, submitEvidence, supportedImageType, translateImage } from './translate.ts'

/** Business face injected into the composer entry. */
export interface UploadButtonInjected {
  /** Host RPC client narrowed to message submission. */
  api: Pick<IApiClient, 'sessions'>
  /** Owning session; the translated evidence is submitted as a plain-text message. */
  sessionId: SessionId
}

const ALLOWED_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/**
 * The "upload and recognize image" control: the selected file is translated
 * through the dsh-vision HTTP endpoint and its evidence is submitted as a
 * text-only message, so the harness image admission never applies — any model
 * on the session can answer.
 * @param props - injected api and session identity.
 */
export function UploadButton({ api, sessionId }: UploadButtonInjected) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    if (!supportedImageType(file.type)) {
      setError('仅支持 PNG、JPEG、WebP 与 GIF 图片')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await fileToBase64(file)
      const result = await translateImage({
        mediaType: file.type,
        data,
        ...file.name === '' ? {} : { name: file.name },
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
      setBusy(false)
      if (inputRef.current !== null) inputRef.current.value = ''
    }
  }

  return (
    <span className="dsh-vision-upload">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="上传图片并转换为文本描述后发送"
      >
        {busy ? '识别中…' : '上传图片'}
      </button>
      {error !== null && <span className="dsh-vision-upload-error">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_ACCEPT}
        hidden
        onChange={event => { void handleFile(event.target.files?.[0]) }}
      />
    </span>
  )
}
