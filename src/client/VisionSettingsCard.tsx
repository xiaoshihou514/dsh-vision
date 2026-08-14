/** Settings -> Plugins card for the host-side dsh-vision settings section. */

import { useSyncExternalStore, useState, type CSSProperties } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type { VisionSettingsScope } from './vision-settings.ts'

export interface VisionSettings {
  backend?: 'glm' | 'qwen'
  baseURL?: string
  apiKeyEnv?: string
  glmModel?: string
  glmMaxTokens?: number
  glmTimeoutMs?: number
  modelId?: string
  revision?: string
  dtype?: 'q4' | 'q4f16' | 'q8' | 'fp16' | 'fp32'
  device?: 'auto' | 'gpu' | 'cpu' | 'cuda' | 'dml' | 'coreml' | 'webgpu'
  cacheDir?: string
  maxNewTokens?: number
}

export interface VisionSettingsCardInjected {
  scope: VisionSettingsScope
  api: Pick<IApiClient, 'credentials'>
}

type Draft = Record<string, string>

const card: CSSProperties = {
  listStyle: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 12,
  background: 'var(--dsw-alias-bg-layer-3)',
}
const header: CSSProperties = {
  width: '100%', appearance: 'none', border: 0, background: 'none', color: 'inherit',
  font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '14px 16px',
  display: 'flex', alignItems: 'center', gap: 12,
}
const field: CSSProperties = { display: 'grid', gap: 5, marginTop: 12 }
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8, padding: '7px 9px', font: 'inherit', color: 'inherit',
  background: 'var(--dsw-alias-bg-layer-3)',
}
const primary: CSSProperties = {
  appearance: 'none', border: 0, borderRadius: 8, padding: '6px 14px', font: 'inherit',
  cursor: 'pointer', color: 'var(--dsw-alias-bg-layer-3)', background: 'var(--dsw-alias-label-primary)',
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function Field(props: {
  label: string
  value: string
  type?: 'text' | 'password' | 'number'
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label style={field}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{props.label}</span>
      <input
        style={input}
        type={props.type ?? 'text'}
        value={props.value}
        disabled={props.disabled}
        autoComplete={props.type === 'password' ? 'off' : undefined}
        onChange={event => { props.onChange(event.target.value) }}
      />
    </label>
  )
}

/** Editable vision backend card contributed to the native plugin configuration slot. */
export function VisionSettingsCard({ scope, api }: VisionSettingsCardInjected) {
  const snapshot = useSyncExternalStore(
    listener => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (snapshot.status === 'unavailable') return null

  const value = snapshot.value ?? {}
  const read = (name: keyof VisionSettings): string => draft[name] ?? text(value[name])
  const edit = (name: keyof VisionSettings, next: string): void => {
    setDraft(current => ({ ...current, [name]: next }))
    setError(null)
  }
  const backend = read('backend') === 'qwen' ? 'qwen' : 'glm'
  const disabled = snapshot.status !== 'ready' || !snapshot.writable || saving

  const save = async (): Promise<void> => {
    if (disabled) return
    setSaving(true)
    setError(null)
    try {
      const numeric = new Set(['glmMaxTokens', 'glmTimeoutMs', 'maxNewTokens'])
      for (const [name, raw] of Object.entries(draft)) {
        const trimmed = raw.trim()
        if (trimmed === '') await scope.unset(name)
        else if (numeric.has(name)) {
          const parsed = Number(trimmed)
          if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
            throw new Error(`${name} 必须是正整数`)
          }
          await scope.set(name, parsed)
        } else await scope.set(name, trimmed)
      }
      if (apiKey.trim() !== '') {
        const ref = read('apiKeyEnv').trim() || 'ZHIPUAI_API_KEY'
        const response = await api.credentials.set({ ref, value: apiKey.trim() })
        if (!response.result.ok) throw new Error(response.result.error.message)
      }
      setDraft({})
      setApiKey('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li style={card}>
      <button type="button" style={header} aria-expanded={open} onClick={() => { setOpen(!open) }}>
        <span style={{ display: 'grid', gap: 4, flex: 1 }}>
          <strong style={{ fontSize: 15 }}>视觉识别</strong>
          <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>
            配置 GLM 云端识图或本地 Qwen3-VL
          </span>
        </span>
        <span aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}>⌄</span>
      </button>
      {open ? (
        <div style={{ borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '0 16px', padding: '2px 0 12px' }}>
          <label style={field}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>识图后端</span>
            <select style={input} value={backend} disabled={disabled} onChange={event => { edit('backend', event.target.value) }}>
              <option value="glm">GLM 云端</option>
              <option value="qwen">Qwen3-VL 本地</option>
            </select>
          </label>
          {backend === 'glm' ? <>
            <Field label="API Key（仅写入凭据存储）" type="password" value={apiKey} disabled={disabled} onChange={setApiKey} />
            <Field label="凭据名称" value={read('apiKeyEnv')} disabled={disabled} onChange={next => { edit('apiKeyEnv', next) }} />
            <Field label="API 地址" value={read('baseURL')} disabled={disabled} onChange={next => { edit('baseURL', next) }} />
            <Field label="GLM 模型" value={read('glmModel')} disabled={disabled} onChange={next => { edit('glmModel', next) }} />
            <Field label="最大输出 tokens" type="number" value={read('glmMaxTokens')} disabled={disabled} onChange={next => { edit('glmMaxTokens', next) }} />
            <Field label="超时（毫秒）" type="number" value={read('glmTimeoutMs')} disabled={disabled} onChange={next => { edit('glmTimeoutMs', next) }} />
          </> : <>
            <Field label="模型仓库" value={read('modelId')} disabled={disabled} onChange={next => { edit('modelId', next) }} />
            <Field label="模型 revision" value={read('revision')} disabled={disabled} onChange={next => { edit('revision', next) }} />
            <Field label="权重格式" value={read('dtype')} disabled={disabled} onChange={next => { edit('dtype', next) }} />
            <Field label="运行设备" value={read('device')} disabled={disabled} onChange={next => { edit('device', next) }} />
            <Field label="模型缓存目录" value={read('cacheDir')} disabled={disabled} onChange={next => { edit('cacheDir', next) }} />
            <Field label="最大输出 tokens" type="number" value={read('maxNewTokens')} disabled={disabled} onChange={next => { edit('maxNewTokens', next) }} />
          </>}
          {error !== null ? <p role="status" style={{ color: 'var(--dsw-alias-label-error)', fontSize: 12 }}>{error}</p> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" disabled={saving || (Object.keys(draft).length === 0 && apiKey === '')} onClick={() => { setDraft({}); setApiKey(''); setError(null) }}>
              放弃更改
            </button>
            <button type="button" style={primary} disabled={disabled || (Object.keys(draft).length === 0 && apiKey === '')} onClick={() => { void save() }}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
