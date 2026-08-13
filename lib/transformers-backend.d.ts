import { n as VisionBackendRequest, t as VisionBackend } from "./backend-rYgBi9sO.js";
import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/transformers-backend.d.ts
/** Pinned model repository. */
declare const DEFAULT_MODEL_ID = "onnx-community/Florence-2-base-ft";
/** Pinned immutable model revision. */
declare const DEFAULT_MODEL_REVISION = "e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f";
/** Florence task used for general visual evidence. */
declare const DEFAULT_TASK = "<MORE_DETAILED_CAPTION>";
/** Output bound for one description. */
declare const DEFAULT_MAX_NEW_TOKENS = 192;
type Transformers = typeof import('@huggingface/transformers');
/** Local backend configuration. */
interface Config {
  /** Hugging Face model repository. */
  modelId?: string;
  /** Immutable repository revision. */
  revision?: string;
  /** ONNX weight format. */
  dtype?: 'q4' | 'q8' | 'fp16' | 'fp32';
  /** Model cache root. Defaults below `DSH_HOME`. */
  cacheDir?: string;
  /** Maximum tokens generated for one description. */
  maxNewTokens?: number;
  /** Florence task prompt. */
  task?: '<CAPTION>' | '<DETAILED_CAPTION>' | '<MORE_DETAILED_CAPTION>' | '<OCR>';
  /** Add a separate OCR pass after the visual description. */
  includeOcr?: boolean;
}
declare const Config: z<Config>;
/** CPU-first Florence-2 implementation with lazy model loading and serialized inference. */
declare class TransformersVisionBackend extends VisionBackend {
  private readonly config;
  private readonly loadRuntime;
  private readonly verifyDefaultModel;
  readonly model: string;
  readonly promptVersion: string;
  private loaded;
  private inferenceTail;
  constructor(ctx: Context, config: Required<Omit<Config, 'cacheDir'>> & {
    cacheDir: string;
  }, loadRuntime?: () => Promise<Transformers>, verifyDefaultModel?: boolean);
  describe(request: VisionBackendRequest): Promise<string>;
  private infer;
  private runTask;
  private load;
  private loadFresh;
}
/** Cordis provider name. */
declare const name = "vision-transformers-backend";
/** Mount the local Florence-2 backend. */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, DEFAULT_MAX_NEW_TOKENS, DEFAULT_MODEL_ID, DEFAULT_MODEL_REVISION, DEFAULT_TASK, TransformersVisionBackend, apply, name };