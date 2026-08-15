/** Same-origin HTTP bridge for the dsh-vision plugin settings card. */

import type { Context } from "@deepseek-ai/cordis";
import {
  settingsNamespace,
  type SettingsPathOp,
} from "@deepseek-ai/dsh-settings";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface WebRouteShape {
  kind: "exact" | "prefix";
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    webServer: { register(route: WebRouteShape): () => void };
  }
}

const HEADER = "x-dsh-vision";
const HEADER_VALUE = "dsh-vision";
const NAMESPACE = settingsNamespace("dsh-vision");

export const name = "vision-settings-api";
export const inject = ["settings", "webServer"];

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > 64 * 1024) {
        reject(new Error("settings request is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

export function apply(ctx: Context): void {
  ctx.webServer.register({
    kind: "exact",
    path: "/dsh-vision/settings",
    handler: async (req, res) => {
      try {
        if (req.headers[HEADER] !== HEADER_VALUE) {
          json(res, 403, { ok: false, error: "forbidden" });
          return;
        }
        if (req.method === "PATCH") {
          const payload = (await readJson(req)) as { ops?: SettingsPathOp[] };
          if (!Array.isArray(payload.ops)) {
            json(res, 400, { ok: false, error: "missing settings operations" });
            return;
          }
          await ctx.settings.mutate(NAMESPACE, payload.ops);
        } else if (req.method !== "GET") {
          json(res, 405, { ok: false, error: "method not allowed" });
          return;
        }
        const descriptor = ctx.settings
          .describe({ redactSecrets: true })
          .find((entry) => entry.ns === NAMESPACE);
        if (descriptor === undefined) {
          json(res, 503, {
            ok: false,
            error: "vision settings are unavailable",
          });
          return;
        }
        json(res, 200, { ok: true, value: descriptor.value });
      } catch (error) {
        ctx
          .logger("dsh-vision")
          .warn(
            "vision settings request failed: %s",
            error instanceof Error ? error.message : String(error),
          );
        json(res, 400, {
          ok: false,
          error:
            error instanceof Error ? error.message : "settings update failed",
        });
      }
    },
  });
}
