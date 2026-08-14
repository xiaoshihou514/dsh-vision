import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

describe('Harness bundle', () => {
  it('declares and ships a parseable Cordis patch', async () => {
    const root = resolve(import.meta.dirname, '..')
    const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string }; client?: { inject?: string[] } }
      files?: string[]
      exports?: Record<string, unknown>
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.files).toContain('cordis.patch.yml')
    expect(manifest.exports).toHaveProperty('./cordis.patch.yml')

    const patch = parse(await readFile(resolve(root, 'cordis.patch.yml'), 'utf8')) as unknown[]
    expect(patch).toHaveLength(2)
    expect(patch).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'agent-default-model' }),
      expect.objectContaining({ insert: expect.any(Array) }),
    ]))
    expect(JSON.stringify(patch)).toContain('dsh-vision/qwen-backend')
    expect(JSON.stringify(patch)).not.toContain('transformers-backend')
    expect(manifest.exports).toHaveProperty('./qwen-backend')
    expect(manifest.exports?.['./client']).toEqual(expect.objectContaining({
      types: './lib/client.d.ts',
      default: './lib/client.js',
    }))
    expect(manifest.dsh?.client?.inject).toEqual(expect.arrayContaining([
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-settings-plugins',
    ]))
  })
})
