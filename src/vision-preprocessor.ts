/** Convert provider-neutral image blocks to vision evidence before an Agent step. */

import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-agent";
import type { AttachmentStore } from "@deepseek-ai/dsh-attachment";
import {
  createUserMessage,
  type ContentBlock,
  type UserMessage,
} from "@deepseek-ai/dsh-llm";
import type { VisionBackend } from "./backend.ts";

export const name = "vision-preprocessor";
export const inject = ["attachments", "visionBackend"];

function focusOf(message: UserMessage): string | undefined {
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  return text === "" ? undefined : text;
}

function imageMarker(names: string[]): ContentBlock {
  const label =
    names.length === 1 ? "图片已识别" : `已识别 ${names.length} 张图片`;
  return {
    type: "text",
    text: names.length === 0 ? label : `${label}：${names.join("、")}`,
  };
}

/**
 * Keep user-authored text visible and move generated evidence into a collapsed
 * context message. No returned message contains an image block.
 */
export async function transcribeImages(
  attachments: AttachmentStore,
  backend: VisionBackend,
  messages: UserMessage[],
  signal: AbortSignal,
): Promise<UserMessage[]> {
  const rewritten: UserMessage[] = [];
  for (const message of messages) {
    const focus = focusOf(message);
    const visible: ContentBlock[] = [];
    const evidence: string[] = [];
    const names: string[] = [];
    for (const block of message.content) {
      if (block.type !== "image") {
        visible.push(block);
        continue;
      }
      signal.throwIfAborted();
      const image = await attachments.readImage(block.attachment, signal);
      const description = await backend.describe({
        image,
        ...(focus === undefined ? {} : { focus }),
        signal,
      });
      signal.throwIfAborted();
      const name = image.ref.name;
      if (name !== undefined) names.push(name);
      const label = name === undefined ? "Image" : `Image: ${name}`;
      evidence.push(`[${label}]\n${description}`);
    }
    if (evidence.length === 0) {
      rewritten.push(message);
      continue;
    }
    // An image-only prompt still needs a small visible record after its native
    // composer preview is consumed; generated visual details stay out of it.
    if (visible.length === 0) visible.push(imageMarker(names));
    rewritten.push(
      { ...message, content: visible },
      createUserMessage({
        source: {
          kind: "plugin",
          plugin: "dsh-vision",
          form: "notice",
          summary:
            evidence.length === 1
              ? "已读取 1 张图片"
              : `已读取 ${evidence.length} 张图片`,
        },
        content: [{ type: "text", text: evidence.join("\n\n") }],
      }),
    );
  }
  return rewritten;
}

/** Install the adapter-neutral image-to-text boundary for every Agent input. */
export function apply(ctx: Context): void {
  ctx.on("agent/pre-step", async (payload, next) => {
    const decision = await next();
    if (decision.kind === "reject") return decision;
    if (
      !decision.messages.some((message) =>
        message.content.some((block) => block.type === "image"),
      )
    )
      return decision;
    return {
      kind: "enter" as const,
      messages: await transcribeImages(
        ctx.attachments,
        ctx.visionBackend,
        decision.messages,
        payload.signal,
      ),
    };
  });
}
