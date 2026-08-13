import { n as VisionBackendRequest, t as VisionBackend } from "./backend-rYgBi9sO.js";
import { c as VisionDescriptionStore, l as VisionMessageSource, o as VisionDescription, r as descriptionCacheKey, s as VisionDescriptionRequest, t as DurableVisionDescriptionStore, u as isVisionMessageSource } from "./durable-descriptions-FkK0v2TF.js";
import { DEFAULT_MAX_NEW_TOKENS, DEFAULT_MODEL_ID, DEFAULT_MODEL_REVISION, DEFAULT_TASK, TransformersVisionBackend } from "./transformers-backend.js";
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
}
declare const Config: z<Config>;
/**
 * Register the synthetic image-capable route.
 * @param ctx - plugin context carrying attachments, descriptions, and LLM routing.
 * @param config - validated route configuration.
 */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, DEFAULT_MAX_NEW_TOKENS, DEFAULT_MODEL_ID, DEFAULT_MODEL_REVISION, DEFAULT_TASK, DurableVisionDescriptionStore, TransformersVisionBackend, VisionAdapter, type VisionAdapterOptions, VisionBackend, type VisionBackendRequest, type VisionDescription, type VisionDescriptionRequest, VisionDescriptionStore, type VisionMessageSource, apply, descriptionCacheKey, inject, isVisionMessageSource, name };