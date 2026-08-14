import { Context } from "@deepseek-ai/cordis";
import { ImageMediaType } from "@deepseek-ai/dsh-attachment";
import z from "@deepseek-ai/schemastery";
import { IncomingMessage, ServerResponse } from "node:http";
//#region src/vision-upload.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** HTTP route registry provided by the harness web server plugin. */
    webServer: {
      register(route: WebRouteShape): () => void;
    };
  }
}
/** Structural match of the harness web route registration contract. */
interface WebRouteShape {
  kind: 'exact' | 'prefix';
  /** Absolute pathname, no trailing slash. */
  path: string;
  /** Owns the full response lifecycle. */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}
/** Upload-translation route configuration. */
interface Config {
  /** Absolute pathname serving translation; must not collide with harness RPC routes. */
  path?: string;
  /** Custom request header required to shield the endpoint from cross-site browser traffic. */
  header?: string;
  /** Largest accepted image payload in bytes (base64-decoded). */
  maxImageBytes?: number;
}
declare const Config: z<Config>;
/** Stable Cordis plugin name. */
declare const name = "vision-upload";
/** Services required by the upload endpoint. */
declare const inject: string[];
/** One client-submitted translation request. */
interface UploadPayload {
  mediaType: ImageMediaType;
  /** Base64-encoded image bytes. */
  data: string;
  /** Optional display name surfaced to the evidence record. */
  name?: string;
  /** Optional user text steering which visual details matter. */
  focus?: string;
}
/**
 * Register the image-translation route. The browser half posts base64 bytes
 * from the composer; the endpoint describes them through the configured
 * vision backend and returns evidence text the caller sends as a plain-text
 * message — no harness image admission is ever involved.
 * @param ctx - plugin context with the vision backend and web route registry.
 * @param config - validated route configuration.
 */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, UploadPayload, WebRouteShape, apply, inject, name };