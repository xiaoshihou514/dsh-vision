/** Integrity and concurrency controls for the bundled Qwen model cache. */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export interface ModelFile {
  path: string
  sha256: string
}

/** Weight files used by the pinned q4 Qwen3-VL inference path. */
export const DEFAULT_Q4_MODEL_FILES: readonly ModelFile[] = [
  { path: 'onnx/decoder_model_merged_q4.onnx', sha256: '7fe8b951dd605513efc01553ee98a00c9335b41c22b68790433bd3563521782f' },
  { path: 'onnx/decoder_model_merged_q4.onnx_data', sha256: '35b8960257384ebe1eb293646f52fdec8d5d25177f37edfb116d63a90f92756c' },
  { path: 'onnx/embed_tokens_q4.onnx', sha256: '9499fcdba2e1cbbc172913fb2fb950d9b53de54b6a9338997b0956feb035bbad' },
  { path: 'onnx/embed_tokens_q4.onnx_data', sha256: '6c3b078ca20e4233f27de203812ba74c6b29d5ae4208932857886582ec6aa50d' },
  { path: 'onnx/vision_encoder_q4.onnx', sha256: '7ccbf866b2e0d0c59272c741715fd78764c8777f1063efe070d420191255c9fe' },
  { path: 'onnx/vision_encoder_q4.onnx_data', sha256: '4582e91d7221675fb1593ab2f13115aa8403f601be2d9826bb0a84619e62af5a' },
]

const LOCK_NAME = '.dsh-vision-download.lock'
const LOCK_STALE_MS = 30 * 60 * 1000

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function digest(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** Remove known corrupt cache entries so the model loader downloads them again. */
export async function discardCorruptModelFiles(root: string, files: readonly ModelFile[]): Promise<void> {
  for (const file of files) {
    const path = join(root, file.path)
    if (!await exists(path)) continue
    if (await digest(path) !== file.sha256) await unlink(path)
  }
}

/** Require every pinned model file to be present and match its manifest digest. */
export async function verifyModelFiles(root: string, files: readonly ModelFile[]): Promise<void> {
  for (const file of files) {
    const path = join(root, file.path)
    if (!await exists(path)) throw new Error(`dsh-vision model download did not produce ${file.path}`)
    if (await digest(path) !== file.sha256) throw new Error(`dsh-vision model integrity check failed for ${file.path}`)
  }
}

/** Serialize model cache mutation across Harness processes. */
export async function withModelCacheLock<T>(cacheDir: string, task: () => Promise<T>): Promise<T> {
  await mkdir(cacheDir, { recursive: true })
  const lockPath = join(cacheDir, LOCK_NAME)
  for (;;) {
    try {
      const handle = await open(lockPath, 'wx')
      await handle.writeFile(`${process.pid}\n`)
      await handle.close()
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const lock = await stat(lockPath).catch(() => undefined)
      if (lock !== undefined && Date.now() - lock.mtimeMs > LOCK_STALE_MS) {
        await unlink(lockPath).catch(() => undefined)
        continue
      }
      await delay(200)
    }
  }
  try {
    return await task()
  } finally {
    await unlink(lockPath).catch(() => undefined)
  }
}

/** Resolve the revision directory layout used by the Transformers.js file cache. */
export function modelRevisionRoot(cacheDir: string, modelId: string, revision: string): string {
  return join(cacheDir, ...modelId.split('/'), revision)
}
