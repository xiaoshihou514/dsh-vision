import { SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it, vi } from 'vitest'
import {
  beginTranscription,
  endTranscription,
  TRANSCRIBING,
  type ComposerBlocks,
} from '../src/client/UploadButton.tsx'

function blocksWith(initial?: string) {
  let reason = initial
  const set = vi.fn(
    (_sessionId: SessionId, block: { reason: string } | undefined) => {
      reason = block?.reason
    },
  )
  const blocks: ComposerBlocks = {
    set,
    storeFor: () => ({
      getSnapshot: () => (reason === undefined ? undefined : { reason }),
    }),
  }
  return { blocks, set, current: () => reason }
}

describe('image transcription composer gate', () => {
  const sessionId = SessionId('session-1')

  it('blocks native send controls until transcription finishes', () => {
    const state = blocksWith()

    expect(beginTranscription(state.blocks, sessionId)).toBeUndefined()
    expect(state.current()).toBe(TRANSCRIBING)
    endTranscription(state.blocks, sessionId)
    expect(state.current()).toBeUndefined()
  })

  it('does not overwrite or clear another plugin blocker', () => {
    const existing = blocksWith('正在处理微信消息')
    expect(beginTranscription(existing.blocks, sessionId)).toBe(
      '正在处理微信消息',
    )
    expect(existing.set).not.toHaveBeenCalled()

    const replaced = blocksWith()
    beginTranscription(replaced.blocks, sessionId)
    replaced.blocks.set(sessionId, { reason: '其他插件正在处理' })
    endTranscription(replaced.blocks, sessionId)
    expect(replaced.current()).toBe('其他插件正在处理')
  })
})
