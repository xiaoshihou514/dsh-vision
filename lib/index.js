import { o as VisionDescriptionStore, r as descriptionCacheKey, s as isVisionMessageSource, t as DurableVisionDescriptionStore } from "./durable-descriptions-D6p9rJ0k.js";
import { a as DEFAULT_TASK, i as DEFAULT_MODEL_REVISION, l as VisionBackend, n as DEFAULT_MAX_NEW_TOKENS, o as TransformersVisionBackend, r as DEFAULT_MODEL_ID } from "./transformers-backend-D_HHPCpd.js";
import z from "@deepseek-ai/schemastery";
import { LlmAdapter, LlmError } from "@deepseek-ai/dsh-llm";
//#region src/adapter.ts
function visualEvidence(description) {
	const ref = description.attachment;
	return [
		"<visual-evidence>",
		`image: ${ref.name === void 0 ? String(ref.attachmentId) : ref.name} (${ref.mediaType}, ${ref.width}x${ref.height})`,
		`analyzer: ${description.model}; prompt: ${description.promptVersion}`,
		description.text,
		"</visual-evidence>"
	].join("\n");
}
async function transformBlocks(blocks, options, dependencies) {
	const transformed = [];
	for (const block of blocks) switch (block.type) {
		case "image": {
			if (options.sessionId === void 0) throw new LlmError("dsh-vision requires a session id before it can persist visual evidence", "VISION_SESSION_REQUIRED");
			const image = await dependencies.attachments.readImage(block.attachment, options.signal);
			const description = await dependencies.descriptions.resolve({
				sessionId: options.sessionId,
				image
			}, options.signal);
			transformed.push({
				type: "text",
				text: visualEvidence(description)
			});
			break;
		}
		case "tool-result":
			transformed.push({
				...block,
				content: await transformBlocks(block.content, options, dependencies)
			});
			break;
		default: transformed.push(structuredClone(block));
	}
	return transformed;
}
async function transformMessages(options, dependencies) {
	const visible = options.messages.filter((message) => !isVisionMessageSource(message.source));
	return Promise.all(visible.map(async (message) => ({
		...message,
		content: await transformBlocks(message.content, options, dependencies)
	})));
}
/** Adapter exposing a vision route while delegating generated text to DeepSeek. */
var VisionAdapter = class extends LlmAdapter {
	options;
	constructor(options) {
		super();
		this.options = options;
		if (options.provider === options.downstreamProvider) throw new LlmError("dsh-vision provider and downstream provider must differ", "VISION_RECURSIVE_ROUTE");
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: this.options.displayName
		};
	}
	listModels(provider) {
		return Promise.resolve([{
			provider,
			id: this.options.downstreamModel,
			name: `${this.options.downstreamModel} + local vision`,
			description: `Local visual analysis delegated to ${this.options.downstreamProvider}/${this.options.downstreamModel}`,
			inputModalities: ["text", "image"]
		}]);
	}
	resolveModel(provider, model) {
		if (model !== this.options.downstreamModel) return Promise.reject(new LlmError(`dsh-vision does not expose model "${model}"`, "VISION_MODEL_MISMATCH"));
		return Promise.resolve({
			provider,
			id: model,
			name: `${model} + local vision`,
			inputModalities: ["text", "image"]
		});
	}
	async *stream(options) {
		if (options.model !== this.options.downstreamModel) throw new LlmError(`dsh-vision does not expose model "${options.model}"`, "VISION_MODEL_MISMATCH");
		const messages = await transformMessages(options, this.options);
		const downstream = {
			...options,
			provider: this.options.downstreamProvider,
			model: this.options.downstreamModel,
			messages
		};
		yield* this.options.stream(downstream);
	}
};
//#endregion
//#region src/index.ts
/** Stable Cordis plugin name. */
const name = "vision-adapter";
/** Services required by the vision wrapper. */
const inject = [
	"attachments",
	"llm",
	"visionDescriptions"
];
const Config = z.object({
	provider: z.string().default("dsh-vision"),
	displayName: z.string().default("DeepSeek + local vision"),
	downstreamProvider: z.string().required(),
	downstreamModel: z.string().required()
});
/**
* Register the synthetic image-capable route.
* @param ctx - plugin context carrying attachments, descriptions, and LLM routing.
* @param config - validated route configuration.
*/
function apply(ctx, config) {
	const provider = config.provider ?? "dsh-vision";
	const adapter = new VisionAdapter({
		provider,
		displayName: config.displayName ?? "DeepSeek + local vision",
		downstreamProvider: config.downstreamProvider,
		downstreamModel: config.downstreamModel,
		stream: (options) => ctx.llm.stream(options),
		attachments: ctx.attachments,
		descriptions: ctx.visionDescriptions
	});
	ctx.llm.registerAdapter([provider], adapter);
}
//#endregion
export { Config, DEFAULT_MAX_NEW_TOKENS, DEFAULT_MODEL_ID, DEFAULT_MODEL_REVISION, DEFAULT_TASK, DurableVisionDescriptionStore, TransformersVisionBackend, VisionAdapter, VisionBackend, VisionDescriptionStore, apply, descriptionCacheKey, inject, isVisionMessageSource, name };
