import { StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
//#region src/glm-backend.d.ts
declare const DEFAULT_GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
declare const DEFAULT_GLM_MODEL = "glm-4.6v-flash";
declare const DEFAULT_GLM_FALLBACK_MODELS: readonly ["glm-4.1v-thinking-flash", "glm-4v-flash"];
interface GlmVisionRequest {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  image: StoredImageAttachment;
  prompt: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}
declare class GlmVisionHttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number);
}
/** Describe one already-verified attachment through an OpenAI-compatible VLM. */
declare function glmVisionChat(request: GlmVisionRequest): Promise<string>;
//#endregion
export { DEFAULT_GLM_BASE_URL, DEFAULT_GLM_FALLBACK_MODELS, DEFAULT_GLM_MODEL, GlmVisionHttpError, GlmVisionRequest, glmVisionChat };