import { Service } from "@deepseek-ai/cordis";
import { createHash } from "node:crypto";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/descriptions.ts
/** Durable visual-description service used by the adapter. @module dsh-vision/descriptions */
/** Return whether a message source is a description persisted by this plugin. */
function isVisionMessageSource(source) {
	return source.kind === "vision" && source.plugin === "dsh-vision";
}
/**
* Durable visual-description repository and inference owner.
* Implementations append a core user message before returning newly produced evidence.
*/
var VisionDescriptionStore = class extends Service {
	constructor(ctx) {
		super(ctx, "visionDescriptions");
	}
};
//#endregion
//#region src/durable-descriptions.ts
const PLUGIN = "dsh-vision";
/** Stable cache key for one attachment under one backend derivation identity. */
function descriptionCacheKey(attachmentId, model, promptVersion, focus) {
	const normalizedFocus = focus?.trim().replace(/\s+/g, " ") ?? "";
	return `${attachmentId}\u0000${model}\u0000${promptVersion}\u0000${createHash("sha256").update(normalizedFocus).digest("hex")}`;
}
function descriptionFromSession(session, cacheKey) {
	for (let index = session.events.length - 1; index >= 0; index -= 1) {
		const event = session.events[index];
		if (event?.type !== "user/message" || !isVisionMessageSource(event.data.source)) continue;
		if (event.data.source.cacheKey !== cacheKey) continue;
		const text = event.data.content.filter((block) => block.type === "text").map((block) => block.text).join("");
		if (text.length === 0) continue;
		return {
			cacheKey,
			attachment: event.data.source.attachment,
			model: event.data.source.model,
			promptVersion: event.data.source.promptVersion,
			text
		};
	}
}
function abortError(signal) {
	return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
/** Session-log implementation with per-session inference coalescing. */
var DurableVisionDescriptionStore = class extends VisionDescriptionStore {
	sessions;
	backend;
	pending = /* @__PURE__ */ new Map();
	constructor(ctx, sessions, backend) {
		super(ctx);
		this.sessions = sessions;
		this.backend = backend;
	}
	async resolve(request, signal) {
		if (signal?.aborted) throw abortError(signal);
		const key = descriptionCacheKey(String(request.image.ref.attachmentId), this.backend.model, this.backend.promptVersion, request.focus);
		const session = this.sessions.get(request.sessionId);
		if (session === void 0) throw new Error(`dsh-vision session "${request.sessionId}" is not live`);
		const stored = descriptionFromSession(session, key);
		if (stored !== void 0) return stored;
		const pendingKey = `${request.sessionId}\u0000${key}`;
		let job = this.pending.get(pendingKey);
		if (job === void 0) {
			const controller = new AbortController();
			const promise = this.create(request, key, controller.signal);
			job = {
				controller,
				promise,
				waiters: 0
			};
			this.pending.set(pendingKey, job);
			promise.finally(() => this.pending.delete(pendingKey)).catch(() => void 0);
		}
		return this.wait(job, signal);
	}
	async create(request, cacheKey, signal) {
		const text = (await this.backend.describe({
			image: request.image,
			...request.focus === void 0 ? {} : { focus: request.focus },
			signal
		})).trim();
		if (text.length === 0) throw new Error("dsh-vision backend returned an empty description");
		const live = this.sessions.get(request.sessionId);
		if (live === void 0) throw new Error(`dsh-vision session "${request.sessionId}" detached during inference`);
		const raced = descriptionFromSession(live, cacheKey);
		if (raced !== void 0) return raced;
		const source = {
			kind: "vision",
			plugin: PLUGIN,
			cacheKey,
			attachment: request.image.ref,
			model: this.backend.model,
			promptVersion: this.backend.promptVersion
		};
		live.append("user/message", createUserMessage({
			content: [{
				type: "text",
				text
			}],
			source
		}), { surfaceOp: "append" });
		return {
			cacheKey,
			attachment: request.image.ref,
			model: this.backend.model,
			promptVersion: this.backend.promptVersion,
			text
		};
	}
	wait(job, signal) {
		job.waiters += 1;
		let settled = false;
		const release = () => {
			if (settled) return;
			settled = true;
			job.waiters -= 1;
			if (job.waiters === 0) job.controller.abort(new DOMException("All callers aborted", "AbortError"));
		};
		if (signal === void 0) return job.promise.finally(release);
		return new Promise((resolve, reject) => {
			const aborted = () => {
				release();
				reject(abortError(signal));
			};
			signal.addEventListener("abort", aborted, { once: true });
			job.promise.then(resolve, reject).finally(() => {
				signal.removeEventListener("abort", aborted);
				release();
			});
		});
	}
};
/** Cordis provider name. */
const name = "vision-descriptions";
/** Services required by the durable description provider. */
const inject = ["sessions", "visionBackend"];
/** Mount the session-backed description service. */
function apply(ctx) {
	new DurableVisionDescriptionStore(ctx, ctx.sessions, ctx.visionBackend);
}
//#endregion
export { DurableVisionDescriptionStore, apply, descriptionCacheKey, inject, name };
