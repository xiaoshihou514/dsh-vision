//#region src/vision-preprocessor.ts
const name = "vision-preprocessor";
const inject = ["attachments", "visionBackend"];
function focusOf(message) {
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  return text === "" ? void 0 : text;
}
/** Replace image blocks without changing message identity, source, or text order. */
async function transcribeImages(attachments, backend, messages, signal) {
  const rewritten = [];
  for (const message of messages) {
    const focus = focusOf(message);
    const content = [];
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
        ...(focus === void 0 ? {} : { focus }),
        signal,
      });
      signal.throwIfAborted();
      const label =
        image.ref.name === void 0
          ? "Image evidence"
          : `Image evidence: ${image.ref.name}`;
      content.push({
        type: "text",
        text: `[${label}]\n${evidence}`,
      });
      changed = true;
    }
    rewritten.push(
      changed
        ? {
            ...message,
            content,
          }
        : message,
    );
  }
  return rewritten;
}
/** Install the adapter-neutral image-to-text boundary for every Agent input. */
function apply(ctx) {
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
export { apply, inject, name, transcribeImages };
