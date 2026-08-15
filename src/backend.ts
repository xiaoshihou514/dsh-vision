/** Local image-analysis backend seam. @module dsh-vision/backend */

import { Context, Service } from "@deepseek-ai/cordis";
import type { StoredImageAttachment } from "@deepseek-ai/dsh-attachment";

declare module "@deepseek-ai/cordis" {
  interface Context {
    visionBackend: VisionBackend;
  }
}

/** Input for one local image-analysis call. */
export interface VisionBackendRequest {
  /** Verified durable image bytes. */
  image: StoredImageAttachment;
  /** Nearby user text that determines which visual details matter. */
  focus?: string;
  /** Cancellation for inference and native-process I/O. */
  signal?: AbortSignal;
}

/** Local visual inference provider. */
export abstract class VisionBackend extends Service {
  constructor(ctx: Context) {
    super(ctx, "visionBackend");
  }

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

export default VisionBackend;
