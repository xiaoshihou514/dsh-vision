/** Model-facing local image tool that delegates pixels to the configured dsh-vision backend. */

import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageMediaType, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import type SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import type ToolRuntime from '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'

type ToolContext = Context & { tools: ToolRuntime; systemPrompt: SystemPrompt }

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MEDIA_TYPES: Readonly<Record<string, ImageMediaType>> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif',
}

function workspaceOf(exec: { agent?: { session?: { header?: { cwd?: string } } } }): string {
  return exec.agent?.session?.header?.cwd ?? process.cwd()
}

async function safeImage(path: string, cwd: string): Promise<StoredImageAttachment> {
  const workspace = await realpath(cwd)
  const requested = isAbsolute(path) ? path : resolve(workspace, path)
  const target = await realpath(requested)
  const rel = relative(workspace, target)
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error(`view_image only reads images inside the current workspace: ${path}`)
  }
  const mediaType = MEDIA_TYPES[extname(target).toLowerCase()]
  if (mediaType === undefined) throw new Error('view_image supports PNG, JPEG, WebP, and GIF files')
  const info = await stat(target)
  if (!info.isFile()) throw new Error(`view_image target is not a regular file: ${path}`)
  if (info.size > MAX_IMAGE_BYTES) throw new Error(`view_image image exceeds the ${MAX_IMAGE_BYTES}-byte limit`)
  const data = await readFile(target)
  return {
    ref: {
      attachmentId: AttachmentId(`sha256:${createHash('sha256').update(data).digest('hex')}`),
      mediaType,
      bytes: data.byteLength,
      // Remote and local backends consume verified bytes and media type; the
      // durable attachment service remains authoritative for display geometry.
      width: 1,
      height: 1,
    },
    data,
  }
}

export const name = 'vision-tool'
export const inject = ['tools', 'systemPrompt', 'visionBackend']

export function apply(ctx: ToolContext): void {
  ctx.tools.register(defineTool({
    name: 'view_image',
    description: 'Inspect an image file in the current workspace with the configured GLM or Qwen vision backend. Returns a textual evidence report and works with text-only DeepSeek models.',
    parameters: {
      file_path: { type: 'string', required: true, description: 'Absolute or workspace-relative PNG/JPEG/WebP/GIF path.' },
      question: { type: 'string', description: 'Specific visual question; omit for a thorough description and OCR.' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    timeoutMs: 300_000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const image = await safeImage(args.file_path, workspaceOf(exec as never))
      return ctx.visionBackend.describe({
        image,
        ...args.question === undefined ? {} : { focus: args.question },
        signal: exec.signal,
      })
    },
  }))
  ctx.systemPrompt.section({
    name: 'tool:dsh-vision',
    order: 114,
    text: 'Use view_image whenever the user asks about an image path or screenshot. It works even though the main DeepSeek model is text-only. Prefer view_image over read_image because view_image delegates pixels to the configured GLM/Qwen vision backend and returns textual evidence.',
  })
}
