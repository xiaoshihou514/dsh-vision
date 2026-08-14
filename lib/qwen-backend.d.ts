import z from "@deepseek-ai/schemastery";
import { Context, Service } from "@deepseek-ai/cordis";
import { StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
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
interface Config {
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
declare const Config: z<Config>;
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
  constructor(ctx: Context, config: Config, loadRuntime?: () => Promise<Transformers>, verifyDefaultModel?: boolean);
  describe(request: VisionBackendRequest): Promise<string>;
  private infer;
  private inferGlm;
  private load;
  private loadFresh;
}
declare const name = "vision-qwen-backend";
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, DEFAULT_MAX_NEW_TOKENS, DEFAULT_MODEL_ID, DEFAULT_MODEL_REVISION, QWEN_VISION_SETTINGS_NAMESPACE, QwenDevice, QwenDtype, QwenVisionBackend, VisionBackendKind, apply, name };