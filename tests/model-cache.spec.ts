import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  discardCorruptModelFiles,
  verifyModelFiles,
  withModelCacheLock,
} from '../src/model-cache.ts'

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'dsh-vision-cache-test-'))
  temporary.push(path)
  return path
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

describe('model cache', () => {
  it('accepts complete matching files', async () => {
    const root = await directory()
    await writeFile(join(root, 'model.bin'), 'correct')

    await expect(verifyModelFiles(root, [{
      path: 'model.bin',
      sha256: sha256('correct'),
    }])).resolves.toBeUndefined()
  })

  it('discards a corrupt file before retrying the download', async () => {
    const root = await directory()
    const path = join(root, 'model.bin')
    await writeFile(path, 'partial')

    await discardCorruptModelFiles(root, [{ path: 'model.bin', sha256: sha256('complete') }])

    await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('serializes cache writers', async () => {
    const root = await directory()
    const order: string[] = []
    let release: (() => void) | undefined
    const first = withModelCacheLock(root, async () => {
      order.push('first-start')
      await new Promise<void>(resolve => release = resolve)
      order.push('first-end')
    })
    await expect.poll(() => order).toEqual(['first-start'])
    const second = withModelCacheLock(root, async () => order.push('second'))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(order).toEqual(['first-start'])

    release?.()
    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-end', 'second'])
  })
})
