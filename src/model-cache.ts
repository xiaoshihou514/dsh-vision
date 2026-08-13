/** Integrity and concurrency controls for the bundled Florence model cache. */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export interface ModelFile {
  path: string
  sha256: string
}

/** Files used by the default q4 Florence-2 inference path. */
export const DEFAULT_Q4_MODEL_FILES: readonly ModelFile[] = [
  { path: 'config.json', sha256: 'd90c22ed72eb55291f183fcd9b98ebd3bd3d92bfcffb6c7f6e1606085e793525' },
  { path: 'generation_config.json', sha256: '7b8eb17bbd6cf8a07f619ad83ae03881eff05b6b9237bab89005b40e77783c29' },
  { path: 'onnx/decoder_model_merged_q4.onnx', sha256: 'be7a2f33e65f8d65538024772fda4d1c5a7752d60a7159aadf53f9f4798b90fa' },
  { path: 'onnx/embed_tokens_q4.onnx', sha256: 'f972f338dedea6b67e10e87aacc0dfd4e247f1e18c60d3911af9e6b9edb68f32' },
  { path: 'onnx/encoder_model_q4.onnx', sha256: '34b17bcf191dacb79bd482b94bad5cf1ba39bc770f6a4c9ae26f28b89c235e4b' },
  { path: 'onnx/vision_encoder_q4.onnx', sha256: '8f211dfc176996d14e24d551f8e02530de781dd8b30d9e7d35b69b7c2d0340ce' },
  { path: 'preprocessor_config.json', sha256: 'c892857e34a7082284983a7717717d39c9bf7e574f1f41d80d4c918c97502efa' },
  { path: 'tokenizer.json', sha256: 'd69dcdb2323e124ac4f800cb9863ddccea0d7bb11e16125e8df3bd60f2f8aeac' },
  { path: 'tokenizer_config.json', sha256: 'd8e64607233cb53b619fb46664f6cad08176c26e0e8735b2d30d888364f19600' },
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
