import { UserMessage } from "@deepseek-ai/dsh-llm";
import { Context, Service } from "@deepseek-ai/cordis";
import { AttachmentStore, StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
//#region src/backend.d.ts
declare module "@deepseek-ai/cordis" {
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
//#region src/vision-preprocessor.d.ts
declare const name = "vision-preprocessor";
declare const inject: string[];
/**
 * Keep user-authored text visible and move generated evidence into a collapsed
 * context message. No returned message contains an image block.
 */
declare function transcribeImages(attachments: AttachmentStore, backend: VisionBackend, messages: UserMessage[], signal: AbortSignal): Promise<UserMessage[]>;
/** Install the adapter-neutral image-to-text boundary for every Agent input. */
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name, transcribeImages };