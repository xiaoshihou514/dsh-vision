import { Buffer } from "node:buffer";
//#region src/glm-backend.ts
const DEFAULT_GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_GLM_MODEL = "glm-4.6v-flash";
const DEFAULT_GLM_FALLBACK_MODELS = ["glm-4.1v-thinking-flash", "glm-4v-flash"];
var GlmVisionHttpError = class extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
function extractText(payload) {
  if (typeof payload !== "object" || payload === null) return void 0;
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) return void 0;
  const content = choices[0].message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return void 0;
  const parts = content.flatMap((part) => {
    if (typeof part !== "object" || part === null) return [];
    const text = part.text;
    return typeof text === "string" ? [text] : [];
  });
  return parts.length === 0 ? void 0 : parts.join("\n");
}
function stripThinking(text) {
  const closed = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  if (closed !== text) return closed.trim();
  return /^\s*<think>/.test(text) ? "" : text.trim();
}
/** Describe one already-verified attachment through an OpenAI-compatible VLM. */
async function glmVisionChat(request) {
  const url = `${request.baseURL.replace(/\/$/, "")}/chat/completions`;
  const imageUrl = `data:${request.image.ref.mediaType};base64,${Buffer.from(request.image.data).toString("base64")}`;
  const signals = [
    AbortSignal.timeout(request.timeoutMs),
    ...(request.signal === void 0 ? [] : [request.signal]),
  ];
  const redact = (value) =>
    request.apiKey === "" ? value : value.replaceAll(request.apiKey, "***");
  let response;
  try {
    response = await (request.fetch ?? fetch)(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.apiKey === ""
          ? {}
          : { authorization: `Bearer ${request.apiKey}` }),
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
              {
                type: "text",
                text: request.prompt,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    throw new Error(
      redact(
        `GLM vision request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
  const body = await response.text();
  if (!response.ok)
    throw new GlmVisionHttpError(
      redact(`GLM vision returned ${response.status}: ${body.slice(0, 500)}`),
      response.status,
    );
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(
      `GLM vision returned non-JSON content: ${body.slice(0, 200)}`,
    );
  }
  const text = extractText(payload);
  if (text === void 0)
    throw new Error(
      `GLM vision returned no assistant text: ${body.slice(0, 300)}`,
    );
  const cleaned = stripThinking(text);
  if (cleaned === "")
    throw new Error(
      "GLM vision returned only reasoning; raise the output-token limit",
    );
  return cleaned;
}
//#endregion
export {
  DEFAULT_GLM_BASE_URL,
  DEFAULT_GLM_FALLBACK_MODELS,
  DEFAULT_GLM_MODEL,
  GlmVisionHttpError,
  glmVisionChat,
};
