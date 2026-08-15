import { symbols } from "@deepseek-ai/cordis";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/vision-preprocessor.ts
/** Convert provider-neutral image blocks to vision evidence before an Agent step. */
const name = "vision-preprocessor";
const inject = ["attachments", "llm", "visionBackend"];
/** Advertise the image capability supplied by this plugin on an existing route. */
function withVisionInput(info) {
  if (info.inputModalities?.includes("image") === true) return info;
  return {
    ...info,
    inputModalities: [...(info.inputModalities ?? ["text"]), "image"],
  };
}
/**
 * Decorate exact-model capability lookup without registering model aliases.
 * API Proxy uses this lookup for image admission before Agent preprocessing.
 */
function installVisionCapability(runtime) {
  const previous = runtime.resolveModelInfo;
  const decorated = async function (...args) {
    return withVisionInput(await previous.apply(this, args));
  };
  runtime.resolveModelInfo = decorated;
  return () => {
    if (runtime.resolveModelInfo === decorated)
      runtime.resolveModelInfo = previous;
  };
}
function focusOf(message) {
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  return text === "" ? void 0 : text;
}
function imageMarker(names) {
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
async function transcribeImages(attachments, backend, messages, signal) {
  const rewritten = [];
  for (const message of messages) {
    const focus = focusOf(message);
    const visible = [];
    const evidence = [];
    const names = [];
    for (const block of message.content) {
      if (block.type !== "image") {
        visible.push(block);
        continue;
      }
      signal.throwIfAborted();
      const image = await attachments.readImage(block.attachment, signal);
      const description = await backend.describe({
        image,
        ...(focus === void 0 ? {} : { focus }),
        signal,
      });
      signal.throwIfAborted();
      const name = image.ref.name;
      if (name !== void 0) names.push(name);
      const label = name === void 0 ? "Image" : `Image: ${name}`;
      evidence.push(`[${label}]\n${description}`);
    }
    if (evidence.length === 0) {
      rewritten.push(message);
      continue;
    }
    if (visible.length === 0) visible.push(imageMarker(names));
    rewritten.push(
      {
        ...message,
        content: visible,
      },
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
        content: [
          {
            type: "text",
            text: evidence.join("\n\n"),
          },
        ],
      }),
    );
  }
  return rewritten;
}
/** Install the adapter-neutral image-to-text boundary for every Agent input. */
function apply(ctx) {
  const traced = ctx.llm;
  const runtime = traced[symbols.original] ?? traced;
  ctx.effect(() => installVisionCapability(runtime));
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
      kind: "enter",
      messages: await transcribeImages(
        ctx.attachments,
        ctx.visionBackend,
        decision.messages,
        payload.signal,
      ),
    };
  });
}
//#endregion
export {
  apply,
  inject,
  installVisionCapability,
  name,
  transcribeImages,
  withVisionInput,
};
