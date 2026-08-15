/** Convert provider-neutral image blocks to vision evidence before an Agent step. */

import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-agent";
import type { AttachmentStore } from "@deepseek-ai/dsh-attachment";
import type { ContentBlock, UserMessage } from "@deepseek-ai/dsh-llm";
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

/** Replace image blocks without changing message identity, source, or text order. */
export async function transcribeImages(
  attachments: AttachmentStore,
  backend: VisionBackend,
  messages: UserMessage[],
  signal: AbortSignal,
): Promise<UserMessage[]> {
  const rewritten: UserMessage[] = [];
  for (const message of messages) {
    const focus = focusOf(message);
    const content: ContentBlock[] = [];
    let changed = false;
    for (const block of message.content) {
      if (block.type !== "image") {
        content.push(block);
        continue;
      }
      signal.throwIfAborted();
      const image = await attachments.readImage(block.attachment, signal);
      const evidence = await backend.describe({
        image,
        ...(focus === undefined ? {} : { focus }),
        signal,
      });
      signal.throwIfAborted();
      const label =
        image.ref.name === undefined
          ? "Image evidence"
          : `Image evidence: ${image.ref.name}`;
      content.push({ type: "text", text: `[${label}]\n${evidence}` });
      changed = true;
    }
    rewritten.push(changed ? { ...message, content } : message);
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
