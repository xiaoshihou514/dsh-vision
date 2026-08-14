import z from "@deepseek-ai/schemastery";
import { GenerateOptions, LlmAdapter, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from "@deepseek-ai/dsh-llm";
import { Context, Service } from "@deepseek-ai/cordis";
import { AttachmentStore, ImageAttachmentRef, StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
import { SessionStore } from "@deepseek-ai/dsh-session";
//#region src/descriptions.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    visionDescriptions: VisionDescriptionStore;
  }
}
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    vision: VisionMessageSource;
  }
}
/** Durable provenance carried by the core user message that stores one description. */
interface VisionMessageSource {
  kind: 'vision';
  plugin: 'dsh-vision';
  cacheKey: string;
  attachment: ImageAttachmentRef;
  model: string;
  promptVersion: string;
}
/** Input needed to find or produce one durable image description. */
interface VisionDescriptionRequest {
  /** Session whose log owns the description message. */
  sessionId: NonNullable<GenerateOptions['sessionId']>;
  /** Verified image bytes and canonical durable reference. */
  image: StoredImageAttachment;
  /** User-visible text accompanying the image. */
  focus?: string;
}
/** Visual evidence persisted before it becomes visible to the downstream model. */
interface VisionDescription {
  /** Stable derivation key for this attachment and analyzer configuration. */
  cacheKey: string;
  /** Reference described by this record. */
  attachment: ImageAttachmentRef;
  /** Versioned local model identity, including quantization where relevant. */
  model: string;
  /** Version of the analysis prompt and text rendering contract. */
  promptVersion: string;
  /** Plain-text observation supplied to the downstream text model. */
  text: string;
}
/** Return whether a message source is a description persisted by this plugin. */
declare function isVisionMessageSource(source: {
  kind: string;
  plugin?: string;
}): source is VisionMessageSource;
/**
 * Durable visual-description repository and inference owner.
 * Implementations append a core user message before returning newly produced evidence.
 */
declare abstract class VisionDescriptionStore extends Service {
  constructor(ctx: Context);
  /**
   * Reuse or create one description, publishing new output durably before return.
   * @param request - owning session and verified image.
   * @param signal - cancellation shared with the model request.
   * @returns persisted visual evidence for the exact derivation identity.
   */
  abstract resolve(request: VisionDescriptionRequest, signal?: AbortSignal): Promise<VisionDescription>;
}
//#endregion
//#region src/adapter.d.ts
/** Constructor dependencies fixed for one adapter registration. */
interface VisionAdapterOptions {
  /** Synthetic route registered by this adapter. */
  provider: string;
  /** Human-readable synthetic route name. */
  displayName: string;
  /** Text-only provider receiving transformed requests. */
  downstreamProvider: string;
  /** Text-only model receiving transformed requests. */
  downstreamModel: string;
  /** Text models exposed through the vision wrapper; each routes to the same downstream model id. */
  downstreamModels?: readonly string[];
  /** Harness LLM streaming entry point used for delegation. */
  stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>;
  /** Durable image byte resolver. */
  attachments: AttachmentStore;
  /** Durable description resolver. */
  descriptions: VisionDescriptionStore;
}
/** Adapter exposing a vision route while delegating generated text to DeepSeek. */
declare class VisionAdapter extends LlmAdapter {
  private readonly options;
  constructor(options: VisionAdapterOptions);
  providerInfo(provider: string): LlmProviderInfo;
  listModels(provider: string): Promise<readonly LlmModelInfo[]>;
  resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
  private models;
}
//#endregion
//#region src/backend.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    visionBackend: VisionBackend;
  }
}
/** Input for one local image-analysis call. */
interface VisionBackendRequest {
  /** Verified durable image bytes. */
  image: StoredImageAttachment;
  /** Nearby user text that determines which visual details matter. */
  focus?: string;
  /** Cancellation for inference and native-process I/O. */
  signal?: AbortSignal;
}
/** Local visual inference provider. */
declare abstract class VisionBackend extends Service {
  constructor(ctx: Context);
  /** Versioned model identity, including quantization. */
  abstract readonly model: string;
  /** Version of the visual-analysis prompt. */
  abstract readonly promptVersion: string;
  /**
   * Describe one verified image.
   * @param request - image bytes and cancellation.
   * @returns non-empty plain-text visual evidence.
   */
  abstract describe(request: VisionBackendRequest): Promise<string>;
}
//#endregion
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
//#region src/durable-descriptions.d.ts
/** Stable cache key for one attachment under one backend derivation identity. */
declare function descriptionCacheKey(attachmentId: string, model: string, promptVersion: string, focus?: string): string;
/** Session-log implementation with per-session inference coalescing. */
declare class DurableVisionDescriptionStore extends VisionDescriptionStore {
  private readonly sessions;
  private readonly backend;
  private readonly pending;
  constructor(ctx: Context, sessions: SessionStore, backend: VisionBackend);
  resolve(request: VisionDescriptionRequest, signal?: AbortSignal): Promise<VisionDescription>;
  private create;
  private wait;
}
//#endregion
//#region src/qwen-backend.d.ts
declare const DEFAULT_MODEL_ID = "onnx-community/Qwen3-VL-2B-Instruct-ONNX";
declare const DEFAULT_MODEL_REVISION = "4739e748dc3798a89254e4932dca19e44aca304a";
declare const DEFAULT_MAX_NEW_TOKENS = 384;
/** User-owned settings section exposed by the Harness plugin configuration UI. */
declare const QWEN_VISION_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
type Transformers = typeof import('@huggingface/transformers');
type QwenDevice = 'auto' | 'gpu' | 'cpu' | 'cuda' | 'dml' | 'coreml' | 'webgpu';
type QwenDtype = 'q4' | 'q4f16' | 'q8' | 'fp16' | 'fp32';
type VisionBackendKind = 'glm' | 'qwen';
interface Config$1 {
  backend?: VisionBackendKind;
  baseURL?: string;
  apiKeyEnv?: string;
  glmModel?: string;
  glmMaxTokens?: number;
  glmTimeoutMs?: number;
  modelId?: string;
  revision?: string;
  dtype?: QwenDtype;
  /** `auto` tries native GPU providers before CPU. */
  device?: QwenDevice;
  cacheDir?: string;
  maxNewTokens?: number;
}
declare const Config$1: z<Config$1>;
/** Qwen3-VL implementation that automatically prefers an available GPU. */
declare class QwenVisionBackend extends VisionBackend {
  private readonly loadRuntime;
  private readonly verifyDefaultModel;
  get promptVersion(): string;
  private loaded;
  private inferenceTail;
  private readonly logger;
  private source;
  /** Current derivation identity; settings changes create distinct durable evidence. */
  get model(): string;
  constructor(ctx: Context, config: Config$1, loadRuntime?: () => Promise<Transformers>, verifyDefaultModel?: boolean);
  describe(request: VisionBackendRequest): Promise<string>;
  private infer;
  private inferGlm;
  private load;
  private loadFresh;
}
//#endregion
//#region src/index.d.ts
/** Stable Cordis plugin name. */
declare const name = "vision-adapter";
/** Services required by the vision wrapper. */
declare const inject: string[];
/** Vision wrapper route configuration. */
interface Config {
  /** Synthetic provider route selected by Harness agents. */
  provider?: string;
  /** Human-readable provider name. */
  displayName?: string;
  /** Existing text-only route that receives transformed requests. */
  downstreamProvider: string;
  /** Model on the downstream route. */
  downstreamModel: string;
  /** Downstream text models that should also appear as image-capable wrapper routes. */
  downstreamModels?: string[];
}
declare const Config: z<Config>;
/**
 * Register the synthetic image-capable route.
 * @param ctx - plugin context carrying attachments, descriptions, and LLM routing.
 * @param config - validated route configuration.
 */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, DEFAULT_GLM_BASE_URL, DEFAULT_GLM_FALLBACK_MODELS, DEFAULT_GLM_MODEL, DEFAULT_MAX_NEW_TOKENS, DEFAULT_MODEL_ID, DEFAULT_MODEL_REVISION, DurableVisionDescriptionStore, GlmVisionHttpError, type GlmVisionRequest, QWEN_VISION_SETTINGS_NAMESPACE, type QwenDevice, type QwenDtype, QwenVisionBackend, VisionAdapter, type VisionAdapterOptions, VisionBackend, type VisionBackendKind, type VisionBackendRequest, type VisionDescription, type VisionDescriptionRequest, VisionDescriptionStore, type VisionMessageSource, apply, descriptionCacheKey, glmVisionChat, inject, isVisionMessageSource, name };