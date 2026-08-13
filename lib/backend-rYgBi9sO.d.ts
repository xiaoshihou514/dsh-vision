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
export { VisionBackendRequest as n, VisionBackend as t };