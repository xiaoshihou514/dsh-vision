import { n as VisionBackendRequest, t as VisionBackend } from "./backend-CDf_s642.js";
import { c as VisionDescriptionStore, l as VisionMessageSource, o as VisionDescription, r as descriptionCacheKey, s as VisionDescriptionRequest, t as DurableVisionDescriptionStore, u as isVisionMessageSource } from "./durable-descriptions-Bh4eIN2w.js";
import { DEFAULT_GLM_BASE_URL, DEFAULT_GLM_FALLBACK_MODELS, DEFAULT_GLM_MODEL, GlmVisionHttpError, GlmVisionRequest, glmVisionChat } from "./glm-backend.js";
import { DEFAULT_MAX_NEW_TOKENS, DEFAULT_MODEL_ID, DEFAULT_MODEL_REVISION, QWEN_VISION_SETTINGS_NAMESPACE, QwenDevice, QwenDtype, QwenVisionBackend, VisionBackendKind } from "./qwen-backend.js";
import z from "@deepseek-ai/schemastery";
import { GenerateOptions, LlmAdapter, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from "@deepseek-ai/dsh-llm";
import { Context } from "@deepseek-ai/cordis";
import { AttachmentStore } from "@deepseek-ai/dsh-attachment";
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