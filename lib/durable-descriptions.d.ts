import { Context, Service } from "@deepseek-ai/cordis";
import { GenerateOptions } from "@deepseek-ai/dsh-llm";
import { SessionStore } from "@deepseek-ai/dsh-session";
import { ImageAttachmentRef, StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
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
/** Cordis provider name. */
declare const name = "vision-descriptions";
/** Services required by the durable description provider. */
declare const inject: string[];
/** Mount the session-backed description service. */
declare function apply(ctx: Context): void;
//#endregion
export { DurableVisionDescriptionStore, apply, descriptionCacheKey, inject, name };