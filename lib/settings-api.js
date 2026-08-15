import { settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/settings-api.ts
const HEADER = "x-dsh-vision";
const HEADER_VALUE = "dsh-vision";
const NAMESPACE = settingsNamespace("dsh-vision");
const name = "vision-settings-api";
const inject = ["settings", "webServer"];
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 65536) {
        reject(/* @__PURE__ */ new Error("settings request is too large"));
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
function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
function apply(ctx) {
  ctx.webServer.register({
    kind: "exact",
    path: "/dsh-vision/settings",
    handler: async (req, res) => {
      try {
        if (req.headers[HEADER] !== HEADER_VALUE) {
          json(res, 403, {
            ok: false,
            error: "forbidden",
          });
          return;
        }
        if (req.method === "PATCH") {
          const payload = await readJson(req);
          if (!Array.isArray(payload.ops)) {
            json(res, 400, {
              ok: false,
              error: "missing settings operations",
            });
            return;
          }
          await ctx.settings.mutate(NAMESPACE, payload.ops);
        } else if (req.method !== "GET") {
          json(res, 405, {
            ok: false,
            error: "method not allowed",
          });
          return;
        }
        const descriptor = ctx.settings
          .describe({ redactSecrets: true })
          .find((entry) => entry.ns === NAMESPACE);
        if (descriptor === void 0) {
          json(res, 503, {
            ok: false,
            error: "vision settings are unavailable",
          });
          return;
        }
        json(res, 200, {
          ok: true,
          value: descriptor.value,
        });
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
//#endregion
export { apply, inject, name };
