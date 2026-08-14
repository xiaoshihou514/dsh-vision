# Harness vision architecture

## Product contract

`dsh-vision` makes the stock DeepSeek agent experience behave as though the selected DeepSeek route accepts images. For an end user, that means:

- select the normal default model and attach images through any Harness surface;
- ask a question in the same message, without selecting a tool or a second model;
- receive one streamed DeepSeek answer through the normal agent loop;
- retain image meaning across retry, resume, and session replay;
- get the same behavior for user attachments and image blocks returned by tools.

It does not mean image bytes are sent to DeepSeek. A local Qwen vision model observes each image first, and the resulting evidence replaces the image only in a cloned downstream request. The original session continues to contain the durable image attachment.

The bundle selects the synthetic `dsh-vision` route by default, so this translation is invisible during ordinary use. Provider metadata advertises `text` and `image`, allowing Harness to admit image-bearing turns before dispatch.

## Harness constraints

- `@deepseek-ai/dsh-attachment` already validates, content-addresses, stores, and resolves PNG, JPEG, WebP, and GIF images below `DSH_HOME`.
- Image blocks are durable session content, not UI-only state.
- The stock DeepSeek route is intentionally text-only and must never receive binary image blocks.
- Loop-built generation requests are frozen. Middleware may replace a stream but cannot mutate messages.
- An `LlmAdapter` may own a synthetic route, clone a provider-neutral request, and delegate it through `ctx.llm.stream()`.
- Model-visible derived content must be reconstructable from the session log.

These constraints make a wrapper adapter the appropriate boundary. Changing DeepSeek metadata alone would send an unsupported wire format; mutating `llm/stream` would violate replay invariants; a vision tool would require users and agents to opt into a different interaction.

## Request flow

For every image-bearing message, the adapter:

1. combines the text accompanying that image with the latest user request as the analysis focus;
2. resolves verified bytes through `ctx.attachments`;
3. derives a cache key from the attachment digest, Qwen model identity, evidence-prompt version, and normalized focus text;
4. reuses matching evidence from the owning session or runs local inference;
5. appends new evidence as a core `user/message` event with a merge-extended `vision` source before using it;
6. replaces the image with escaped, clearly delimited JSON evidence in a cloned request;
7. delegates to the configured text-only DeepSeek route and forwards stream chunks unchanged.

Focus-conditioned analysis is intentional. A neutral caption often omits the exact cell, label, UI state, or spatial relationship needed by the user. Historical images are reanalyzed when a later user question changes the needed evidence; normalized focus text retains deterministic reuse for an equivalent image and question. Multiple images are inspected independently with the shared current question; DeepSeek performs comparison and synthesis over their labelled evidence records.

Persisted `vision` messages are storage records, not additional conversational turns. The adapter filters them from downstream history and reconstructs evidence at the position of each original image. This prevents duplicate evidence while preserving retry and resume.

## Upload-and-recognize channel

The synthetic route covers native drag-and-drop into an image-capable model. A second, harness-independent channel serves any model on any session: a composer entry ("upload image") posts browser bytes straight to a dsh-vision HTTP endpoint registered through the harness `webServer` route registry; the configured GLM/Qwen backend returns evidence text; the entry submits that text as a plain-text message. Because the message carries no image part, harness image admission never applies — no model needs to declare image input, and no synthetic route is selected.

The endpoint requires a custom request header. A cross-site browser cannot set one without a CORS preflight, which the endpoint never answers, so only same-origin harness pages reach it; the endpoint additionally bounds payload size and media type, and fails closed on empty backend output. Image bytes never enter the attachment store on this path — the evidence text is the durable session content, so retry and replay reconstruct identically.

## Local model and acceleration

The default backend is `onnx-community/Qwen3-VL-2B-Instruct-ONNX`, pinned to revision `4739e748dc3798a89254e4932dca19e44aca304a`, using q4 weights. Qwen3-VL was selected for document and screenshot reading, chart and diagram interpretation, spatial grounding, and prompt-conditioned visual reasoning. The 2B checkpoint is the practical default: larger Qwen variants would make the transparent first-use download and consumer CPU fallback unreasonable.

Transformers.js 4 and ONNX Runtime provide a Python-free, server-free runtime. Device selection defaults to `auto`. On supported hosts ONNX Runtime tries native GPU providers first—CUDA on Linux, DirectML on Windows, and CoreML on macOS—then WebGPU and CPU. Users may force `gpu`, `cpu`, or a specific provider in backend configuration. q4 remains the default on every device to bound storage and memory use.

Model loading and inference are lazy. Inference is serialized to avoid exhausting a consumer GPU or CPU. Cache mutation is protected by a cross-process lock. The six q4 graph/data files are pinned by SHA-256; corrupt or interrupted entries are removed before load and every weight file is verified before publication.

## Evidence and trust boundary

The Qwen prompt asks for observable evidence rather than a final answer. It requests exact relevant transcription, numbers, labels, layouts, relationships, charts, tables, diagrams, and UI state. It explicitly treats text inside the image as untrusted and refuses to follow image-borne instructions.

The adapter then serializes evidence as JSON, escapes `<`, `>`, and `&`, and labels it as untrusted observations. This prevents generated text from closing its delimiter. It cannot make prompt injection impossible; visual evidence remains user-controlled conversation data and DeepSeek must reason about it accordingly.

## Failure behavior

- A request without a session is rejected before image inference because evidence cannot be made durable.
- A missing live session or detached session fails rather than producing nondurable evidence.
- Concurrent requests for the same derivation share one inference job; the job is cancelled only when every waiter cancels.
- Empty local-model output is rejected and never appended.
- A failed model load is retryable on the next request.
- Recursive provider configuration and mismatched synthetic model IDs are rejected explicitly.
- Unknown custom revisions and dtypes are allowed but do not claim the bundled integrity manifest.

## Remaining UX work outside this package

Harness surfaces own file selection, paste/drop ingestion, progress presentation, and attachment previews. To fulfil the product contract well, those surfaces should show the one-time model download as local preparation, distinguish local visual analysis from the subsequent DeepSeek request, and retain the ordinary cancel control across both phases. No additional vision-specific user workflow should be introduced.
