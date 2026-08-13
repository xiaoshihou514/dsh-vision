import z from "@deepseek-ai/schemastery";
import { Service } from "@deepseek-ai/cordis";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, stat, unlink } from "node:fs/promises";
//#region src/backend.ts
/** Local image-analysis backend seam. @module dsh-vision/backend */
/** Local visual inference provider. */
var VisionBackend = class extends Service {
	constructor(ctx) {
		super(ctx, "visionBackend");
	}
};
//#endregion
//#region src/model-cache.ts
/** Integrity and concurrency controls for the bundled Florence model cache. */
/** Files used by the default q4 Florence-2 inference path. */
const DEFAULT_Q4_MODEL_FILES = [
	{
		path: "config.json",
		sha256: "d90c22ed72eb55291f183fcd9b98ebd3bd3d92bfcffb6c7f6e1606085e793525"
	},
	{
		path: "generation_config.json",
		sha256: "7b8eb17bbd6cf8a07f619ad83ae03881eff05b6b9237bab89005b40e77783c29"
	},
	{
		path: "onnx/decoder_model_merged_q4.onnx",
		sha256: "be7a2f33e65f8d65538024772fda4d1c5a7752d60a7159aadf53f9f4798b90fa"
	},
	{
		path: "onnx/embed_tokens_q4.onnx",
		sha256: "f972f338dedea6b67e10e87aacc0dfd4e247f1e18c60d3911af9e6b9edb68f32"
	},
	{
		path: "onnx/encoder_model_q4.onnx",
		sha256: "34b17bcf191dacb79bd482b94bad5cf1ba39bc770f6a4c9ae26f28b89c235e4b"
	},
	{
		path: "onnx/vision_encoder_q4.onnx",
		sha256: "8f211dfc176996d14e24d551f8e02530de781dd8b30d9e7d35b69b7c2d0340ce"
	},
	{
		path: "preprocessor_config.json",
		sha256: "c892857e34a7082284983a7717717d39c9bf7e574f1f41d80d4c918c97502efa"
	},
	{
		path: "tokenizer.json",
		sha256: "d69dcdb2323e124ac4f800cb9863ddccea0d7bb11e16125e8df3bd60f2f8aeac"
	},
	{
		path: "tokenizer_config.json",
		sha256: "d8e64607233cb53b619fb46664f6cad08176c26e0e8735b2d30d888364f19600"
	}
];
const LOCK_NAME = ".dsh-vision-download.lock";
const LOCK_STALE_MS = 18e5;
function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function digest(path) {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
}
async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
/** Remove known corrupt cache entries so the model loader downloads them again. */
async function discardCorruptModelFiles(root, files) {
	for (const file of files) {
		const path = join(root, file.path);
		if (!await exists(path)) continue;
		if (await digest(path) !== file.sha256) await unlink(path);
	}
}
/** Require every pinned model file to be present and match its manifest digest. */
async function verifyModelFiles(root, files) {
	for (const file of files) {
		const path = join(root, file.path);
		if (!await exists(path)) throw new Error(`dsh-vision model download did not produce ${file.path}`);
		if (await digest(path) !== file.sha256) throw new Error(`dsh-vision model integrity check failed for ${file.path}`);
	}
}
/** Serialize model cache mutation across Harness processes. */
async function withModelCacheLock(cacheDir, task) {
	await mkdir(cacheDir, { recursive: true });
	const lockPath = join(cacheDir, LOCK_NAME);
	for (;;) try {
		const handle = await open(lockPath, "wx");
		await handle.writeFile(`${process.pid}\n`);
		await handle.close();
		break;
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
		const lock = await stat(lockPath).catch(() => void 0);
		if (lock !== void 0 && Date.now() - lock.mtimeMs > LOCK_STALE_MS) {
			await unlink(lockPath).catch(() => void 0);
			continue;
		}
		await delay(200);
	}
	try {
		return await task();
	} finally {
		await unlink(lockPath).catch(() => void 0);
	}
}
/** Resolve the revision directory layout used by the Transformers.js file cache. */
function modelRevisionRoot(cacheDir, modelId, revision) {
	return join(cacheDir, ...modelId.split("/"), revision);
}
//#endregion
//#region src/transformers-backend.ts
/** Florence-2 backend powered by Transformers.js and ONNX Runtime. @module dsh-vision/transformers-backend */
/** Pinned model repository. */
const DEFAULT_MODEL_ID = "onnx-community/Florence-2-base-ft";
/** Pinned immutable model revision. */
const DEFAULT_MODEL_REVISION = "e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f";
/** Florence task used for general visual evidence. */
const DEFAULT_TASK = "<MORE_DETAILED_CAPTION>";
/** Output bound for one description. */
const DEFAULT_MAX_NEW_TOKENS = 192;
const Config = z.object({
	modelId: z.string().default(DEFAULT_MODEL_ID),
	revision: z.string().default(DEFAULT_MODEL_REVISION),
	dtype: z.union([
		"q4",
		"q8",
		"fp16",
		"fp32"
	]).default("q4"),
	cacheDir: z.string(),
	maxNewTokens: z.number().step(1).min(1).max(1024).default(192),
	task: z.union([
		"<CAPTION>",
		"<DETAILED_CAPTION>",
		"<MORE_DETAILED_CAPTION>",
		"<OCR>"
	]).default(DEFAULT_TASK),
	includeOcr: z.boolean().default(true)
});
function defaultCacheDir() {
	const dshHome = process.env.DSH_HOME?.trim();
	return resolve(join(dshHome === void 0 || dshHome === "" ? join(homedir(), ".dsh") : dshHome, "models", "dsh-vision"));
}
function abortReason(signal) {
	return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
function waitFor(promise, signal) {
	if (signal === void 0) return promise;
	if (signal.aborted) return Promise.reject(abortReason(signal));
	return new Promise((resolvePromise, reject) => {
		const aborted = () => reject(abortReason(signal));
		signal.addEventListener("abort", aborted, { once: true });
		promise.then(resolvePromise, reject).finally(() => signal.removeEventListener("abort", aborted));
	});
}
/** CPU-first Florence-2 implementation with lazy model loading and serialized inference. */
var TransformersVisionBackend = class extends VisionBackend {
	config;
	loadRuntime;
	verifyDefaultModel;
	model;
	promptVersion;
	loaded;
	inferenceTail = Promise.resolve();
	constructor(ctx, config, loadRuntime = () => import("@huggingface/transformers"), verifyDefaultModel = true) {
		super(ctx);
		this.config = config;
		this.loadRuntime = loadRuntime;
		this.verifyDefaultModel = verifyDefaultModel;
		this.model = `${config.modelId}@${config.revision}:${config.dtype}`;
		this.promptVersion = `florence2:${config.task}:ocr-${config.includeOcr}:tokens-${config.maxNewTokens}:v2`;
	}
	describe(request) {
		const run = this.inferenceTail.then(async () => {
			if (request.signal?.aborted) throw abortReason(request.signal);
			return this.infer(request);
		});
		this.inferenceTail = run.then(() => void 0, () => void 0);
		return run;
	}
	async infer(request) {
		const loaded = await waitFor(this.load(), request.signal);
		const bytes = request.image.data.slice().buffer;
		const image = await loaded.runtime.RawImage.fromBlob(new Blob([bytes], { type: request.image.ref.mediaType }));
		const describe = await this.runTask(loaded, image, this.config.task, request.signal);
		if (!this.config.includeOcr || this.config.task === "<OCR>") return describe;
		const ocr = await this.runTask(loaded, image, "<OCR>", request.signal);
		return ocr.length === 0 ? describe : `${describe}\n\nVisible text (OCR):\n${ocr}`;
	}
	async runTask(loaded, image, task, signal) {
		const prompts = loaded.processor.construct_prompts(task);
		const inputs = await loaded.processor(image, prompts);
		const stopping = new loaded.runtime.InterruptableStoppingCriteria();
		const criteria = new loaded.runtime.StoppingCriteriaList();
		criteria.push(stopping);
		const abort = () => stopping.interrupt();
		signal?.addEventListener("abort", abort, { once: true });
		try {
			const generated = await loaded.model.generate({
				...inputs,
				max_new_tokens: this.config.maxNewTokens,
				stopping_criteria: criteria
			});
			if (signal?.aborted) throw abortReason(signal);
			const decoded = loaded.processor.batch_decode(generated, { skip_special_tokens: false })[0];
			if (decoded === void 0) throw new Error("Florence-2 returned no decoded output");
			const text = loaded.processor.post_process_generation(decoded, task, image.size)[task];
			if (typeof text !== "string") throw new Error(`Florence-2 returned an unsupported result for ${task}`);
			return text.trim();
		} finally {
			signal?.removeEventListener("abort", abort);
		}
	}
	load() {
		this.loaded ??= this.loadFresh().catch((error) => {
			this.loaded = void 0;
			throw error;
		});
		return this.loaded;
	}
	async loadFresh() {
		return withModelCacheLock(this.config.cacheDir, async () => {
			const runtime = await this.loadRuntime();
			const options = {
				cache_dir: this.config.cacheDir,
				revision: this.config.revision
			};
			const verifiesDefault = this.verifyDefaultModel && this.config.modelId === "onnx-community/Florence-2-base-ft" && this.config.revision === "e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f" && this.config.dtype === "q4";
			const revisionRoot = modelRevisionRoot(this.config.cacheDir, this.config.modelId, this.config.revision);
			if (verifiesDefault) await discardCorruptModelFiles(revisionRoot, DEFAULT_Q4_MODEL_FILES);
			const [model, processor] = await Promise.all([runtime.Florence2ForConditionalGeneration.from_pretrained(this.config.modelId, {
				...options,
				dtype: this.config.dtype
			}), runtime.AutoProcessor.from_pretrained(this.config.modelId, options)]);
			if (verifiesDefault) await verifyModelFiles(revisionRoot, DEFAULT_Q4_MODEL_FILES);
			return {
				model,
				processor,
				runtime
			};
		});
	}
};
/** Cordis provider name. */
const name = "vision-transformers-backend";
/** Mount the local Florence-2 backend. */
function apply(ctx, config) {
	new TransformersVisionBackend(ctx, {
		modelId: config.modelId ?? "onnx-community/Florence-2-base-ft",
		revision: config.revision ?? "e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f",
		dtype: config.dtype ?? "q4",
		cacheDir: resolve(config.cacheDir ?? defaultCacheDir()),
		maxNewTokens: config.maxNewTokens ?? 192,
		task: config.task ?? "<MORE_DETAILED_CAPTION>",
		includeOcr: config.includeOcr ?? true
	});
}
//#endregion
export { DEFAULT_TASK as a, name as c, DEFAULT_MODEL_REVISION as i, VisionBackend as l, DEFAULT_MAX_NEW_TOKENS as n, TransformersVisionBackend as o, DEFAULT_MODEL_ID as r, apply as s, Config as t };
