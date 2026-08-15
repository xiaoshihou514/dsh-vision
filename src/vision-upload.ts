/** HTTP image-translation endpoint: browser bytes in, evidence text out. @module dsh-vision/vision-upload */

import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Context } from "@deepseek-ai/cordis";
import { AttachmentId } from "@deepseek-ai/dsh-attachment";
import type {
  ImageMediaType,
  StoredImageAttachment,
} from "@deepseek-ai/dsh-attachment";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import type { SettingsPathOp } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** HTTP route registry provided by the harness web server plugin. */
    webServer: {
      register(route: WebRouteShape): () => void;
    };
  }
}

/** Structural match of the harness web route registration contract. */
export interface WebRouteShape {
  kind: "exact" | "prefix";
  /** Absolute pathname, no trailing slash. */
  path: string;
  /** Owns the full response lifecycle. */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES: readonly ImageMediaType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const HEADER_VALUE = "dsh-vision";

/** Upload-translation route configuration. */
export interface Config {
  /** Absolute pathname serving translation; must not collide with harness RPC routes. */
  path?: string;
  /** Custom request header required to shield the endpoint from cross-site browser traffic. */
  header?: string;
  /** Largest accepted image payload in bytes (base64-decoded). */
  maxImageBytes?: number;
}

export const Config: z<Config> = z.object({
  path: z.string().default("/dsh-vision/vision"),
  header: z.string().default("x-dsh-vision"),
  maxImageBytes: z.natural().min(1024).default(DEFAULT_MAX_IMAGE_BYTES),
});

/** Stable Cordis plugin name. */
export const name = "vision-upload";

/** Services required by the upload endpoint. */
export const inject = ["visionBackend", "webServer", "settings"];

/** One client-submitted translation request. */
export interface UploadPayload {
  mediaType: ImageMediaType;
  /** Base64-encoded image bytes. */
  data: string;
  /** Optional display name surfaced to the evidence record. */
  name?: string;
  /** Optional user text steering which visual details matter. */
  focus?: string;
}

function readJsonBody(req: IncomingMessage, limit: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error("request body exceeds the upload limit"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

/**
 * Register the image-translation route. The browser half posts base64 bytes
 * from the composer; the endpoint describes them through the configured
 * vision backend and returns evidence text the caller sends as a plain-text
 * message — no harness image admission is ever involved.
 * @param ctx - plugin context with the vision backend and web route registry.
 * @param config - validated route configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const path = config.path ?? "/dsh-vision/vision";
  const header = config.header ?? "x-dsh-vision";
  const maxImageBytes = config.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const route: WebRouteShape = {
    kind: "exact",
    path,
    handler: async (req, res) => {
      try {
        if (req.method !== "POST") {
          writeJson(res, 405, { ok: false, error: "method not allowed" });
          return;
        }
        // A custom header forces a CORS preflight on cross-site browsers; this
        // handler never answers preflight, so only same-origin harness pages
        // (which may set the header freely) reach the endpoint.
        if (req.headers[header] !== HEADER_VALUE) {
          writeJson(res, 403, { ok: false, error: "forbidden" });
          return;
        }
        const payload = (await readJsonBody(
          req,
          maxImageBytes * 2 + 64 * 1024,
        )) as Partial<UploadPayload>;
        if (typeof payload.data !== "string" || payload.data.length === 0) {
          writeJson(res, 400, { ok: false, error: "missing image data" });
          return;
        }
        const mediaType = payload.mediaType;
        if (
          typeof mediaType !== "string" ||
          !MEDIA_TYPES.includes(mediaType as ImageMediaType)
        ) {
          writeJson(res, 400, { ok: false, error: "unsupported media type" });
          return;
        }
        let bytes: Uint8Array;
        try {
          bytes = Uint8Array.from(Buffer.from(payload.data, "base64"));
        } catch {
          writeJson(res, 400, { ok: false, error: "invalid base64" });
          return;
        }
        if (bytes.byteLength === 0 || bytes.byteLength > maxImageBytes) {
          writeJson(res, 400, { ok: false, error: "image size out of range" });
          return;
        }
        const image: StoredImageAttachment = {
          ref: {
            attachmentId: AttachmentId(
              `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
            ),
            mediaType: mediaType as ImageMediaType,
            bytes: bytes.byteLength,
            // The durable attachment service stays authoritative for display
            // geometry; backend consumption uses verified bytes and media type.
            width: 1,
            height: 1,
            ...(payload.name === undefined || payload.name === ""
              ? {}
              : { name: payload.name }),
          },
          data: bytes,
        };
        const text = await ctx.visionBackend.describe({
          image,
          ...(payload.focus === undefined || payload.focus === ""
            ? {}
            : { focus: payload.focus }),
        });
        if (text.trim().length === 0) {
          writeJson(res, 502, {
            ok: false,
            error: "vision backend returned empty evidence",
          });
          return;
        }
        writeJson(res, 200, { ok: true, text });
      } catch (error) {
        ctx
          .logger("dsh-vision")
          .warn(
            "vision upload failed: %s",
            error instanceof Error ? error.message : String(error),
          );
        writeJson(res, 500, { ok: false, error: "translation failed" });
      }
    },
  };
  ctx.webServer.register(route);
  ctx.webServer.register({
    kind: "exact",
    path: "/dsh-vision/settings",
    handler: async (req, res) => {
      try {
        if (req.headers[header] !== HEADER_VALUE) {
          writeJson(res, 403, { ok: false, error: "forbidden" });
          return;
        }
        const namespace = settingsNamespace("dsh-vision");
        if (req.method === "PATCH") {
          const payload = (await readJsonBody(req, 64 * 1024)) as {
            ops?: SettingsPathOp[];
          };
          if (!Array.isArray(payload.ops)) {
            writeJson(res, 400, {
              ok: false,
              error: "missing settings operations",
            });
            return;
          }
          await ctx.settings.mutate(namespace, payload.ops);
        } else if (req.method !== "GET") {
          writeJson(res, 405, { ok: false, error: "method not allowed" });
          return;
        }
        const descriptor = ctx.settings
          .describe({ redactSecrets: true })
          .find((entry) => entry.ns === namespace);
        if (descriptor === undefined) {
          writeJson(res, 503, {
            ok: false,
            error: "vision settings are unavailable",
          });
          return;
        }
        writeJson(res, 200, { ok: true, value: descriptor.value });
      } catch (error) {
        ctx
          .logger("dsh-vision")
          .warn(
            "vision settings request failed: %s",
            error instanceof Error ? error.message : String(error),
          );
        writeJson(res, 400, {
          ok: false,
          error:
            error instanceof Error ? error.message : "settings update failed",
        });
      }
    },
  });
}
