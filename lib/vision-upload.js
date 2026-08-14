import { createHash } from "node:crypto";
import "@deepseek-ai/cordis";
import { AttachmentId } from "@deepseek-ai/dsh-attachment";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
//#region src/vision-upload.ts
/** HTTP image-translation endpoint: browser bytes in, evidence text out. @module dsh-vision/vision-upload */
const DEFAULT_MAX_IMAGE_BYTES = 10485760;
const MEDIA_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif"
];
const HEADER_VALUE = "dsh-vision";
const Config = z.object({
	path: z.string().default("/dsh-vision/vision"),
	header: z.string().default("x-dsh-vision"),
	maxImageBytes: z.natural().min(1024).default(DEFAULT_MAX_IMAGE_BYTES)
});
/** Stable Cordis plugin name. */
const name = "vision-upload";
/** Services required by the upload endpoint. */
const inject = [
	"visionBackend",
	"webServer",
	"settings"
];
function readJsonBody(req, limit) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let total = 0;
		req.on("data", (chunk) => {
			total += chunk.length;
			if (total > limit) {
				reject(/* @__PURE__ */ new Error("request body exceeds the upload limit"));
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
function writeJson(res, status, value) {
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
function apply(ctx, config) {
	const path = config.path ?? "/dsh-vision/vision";
	const header = config.header ?? "x-dsh-vision";
	const maxImageBytes = config.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES;
	const route = {
		kind: "exact",
		path,
		handler: async (req, res) => {
			try {
				if (req.method !== "POST") {
					writeJson(res, 405, {
						ok: false,
						error: "method not allowed"
					});
					return;
				}
				if (req.headers[header] !== HEADER_VALUE) {
					writeJson(res, 403, {
						ok: false,
						error: "forbidden"
					});
					return;
				}
				const payload = await readJsonBody(req, maxImageBytes * 2 + 65536);
				if (typeof payload.data !== "string" || payload.data.length === 0) {
					writeJson(res, 400, {
						ok: false,
						error: "missing image data"
					});
					return;
				}
				const mediaType = payload.mediaType;
				if (typeof mediaType !== "string" || !MEDIA_TYPES.includes(mediaType)) {
					writeJson(res, 400, {
						ok: false,
						error: "unsupported media type"
					});
					return;
				}
				let bytes;
				try {
					bytes = Uint8Array.from(Buffer.from(payload.data, "base64"));
				} catch {
					writeJson(res, 400, {
						ok: false,
						error: "invalid base64"
					});
					return;
				}
				if (bytes.byteLength === 0 || bytes.byteLength > maxImageBytes) {
					writeJson(res, 400, {
						ok: false,
						error: "image size out of range"
					});
					return;
				}
				const image = {
					ref: {
						attachmentId: AttachmentId(`sha256:${createHash("sha256").update(bytes).digest("hex")}`),
						mediaType,
						bytes: bytes.byteLength,
						width: 1,
						height: 1,
						...payload.name === void 0 || payload.name === "" ? {} : { name: payload.name }
					},
					data: bytes
				};
				const text = await ctx.visionBackend.describe({
					image,
					...payload.focus === void 0 || payload.focus === "" ? {} : { focus: payload.focus }
				});
				if (text.trim().length === 0) {
					writeJson(res, 502, {
						ok: false,
						error: "vision backend returned empty evidence"
					});
					return;
				}
				writeJson(res, 200, {
					ok: true,
					text
				});
			} catch (error) {
				ctx.logger("dsh-vision").warn("vision upload failed: %s", error instanceof Error ? error.message : String(error));
				writeJson(res, 500, {
					ok: false,
					error: "translation failed"
				});
			}
		}
	};
	ctx.webServer.register(route);
	ctx.webServer.register({
		kind: "exact",
		path: "/dsh-vision/settings",
		handler: async (req, res) => {
			try {
				if (req.headers[header] !== HEADER_VALUE) {
					writeJson(res, 403, {
						ok: false,
						error: "forbidden"
					});
					return;
				}
				const namespace = settingsNamespace("dsh-vision");
				if (req.method === "PATCH") {
					const payload = await readJsonBody(req, 65536);
					if (!Array.isArray(payload.ops)) {
						writeJson(res, 400, {
							ok: false,
							error: "missing settings operations"
						});
						return;
					}
					await ctx.settings.mutate(namespace, payload.ops);
				} else if (req.method !== "GET") {
					writeJson(res, 405, {
						ok: false,
						error: "method not allowed"
					});
					return;
				}
				const descriptor = ctx.settings.describe({ redactSecrets: true }).find((entry) => entry.ns === namespace);
				if (descriptor === void 0) {
					writeJson(res, 503, {
						ok: false,
						error: "vision settings are unavailable"
					});
					return;
				}
				writeJson(res, 200, {
					ok: true,
					value: descriptor.value
				});
			} catch (error) {
				ctx.logger("dsh-vision").warn("vision settings request failed: %s", error instanceof Error ? error.message : String(error));
				writeJson(res, 400, {
					ok: false,
					error: error instanceof Error ? error.message : "settings update failed"
				});
			}
		}
	});
}
//#endregion
export { Config, apply, inject, name };
