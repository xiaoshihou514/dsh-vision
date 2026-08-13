# Harness vision architecture

## Goal

`dsh-vision` makes a text-only DeepSeek route accept image-bearing Harness conversations without replacing the Harness attachment, session, agent-loop, or provider implementations. The first supported hosts are Linux and Windows. Local inference must run without Python, a system package manager, or a separately installed model server.

## Harness findings

- Harness already has a complete image attachment seam. `@deepseek-ai/dsh-attachment` defines durable image references and `@deepseek-ai/dsh-attachment-local` validates, content-addresses, stores, and reads PNG, JPEG, WebP, and GIF data below `DSH_HOME`.
- `ContentBlock` already includes an `image` block containing a durable `ImageAttachmentRef`. Image blocks are valid session-log content rather than UI-only state.
- The pi-ai adapter resolves durable references only at provider dispatch. Provider model metadata declares `inputModalities`; Harness refuses images before dispatch when the selected model is text-only.
- DeepSeek's official chat-completions route is intentionally declared text-only and cannot be changed through provider settings.
- Loop-built `GenerateOptions` are deep-frozen before the `llm/stream` waterfall. Middleware may inspect or replace the stream, but it must not mutate messages. This is a deliberate replay invariant.
- An `LlmAdapter` owns one or more provider route names and receives the complete provider-neutral request. It may yield another `AsyncIterable<StreamChunk>`, which allows a wrapper adapter to delegate a cloned request through `ctx.llm.stream()` to a different route.
- Anything model-visible must be reconstructable from the session log. A generated caption or OCR result cannot live only in an adapter cache.

## Decision

Implement `dsh-vision` as a synthetic vision-capable LLM adapter, not as `llm/stream` mutation and not as a replacement attachment store.

The selected Harness route will be owned by `dsh-vision` and advertise text plus image input. Its configuration names the downstream text route and model. For each image-bearing request the adapter will:

1. Resolve every durable image through `ctx.attachments`.
2. Derive an immutable cache key from the attachment digest, local vision model identity, prompt-template version, and inference settings.
3. Reuse a matching description message from the owning session, or run the local vision backend and append that message before downstream dispatch.
4. Clone the frozen request, replace image blocks with clearly delimited textual visual evidence, and select the configured downstream DeepSeek route and model.
5. Delegate through `ctx.llm.stream()` and forward its chunks unchanged.

The transformation is reconstructable because the original image reference, the generated description, and its derivation identity are durable. Descriptions use the core `user/message` event with a merge-extended `vision` message source. Harness persistence has a generated set of known event types, so an out-of-tree required `vision/description` event could not be resumed by the stock coordinator. Replaying the synthetic adapter filters the storage message, performs the same inline replacement, and does not rerun inference.

## Why not the alternatives

- Changing DeepSeek model metadata to claim image input would let binary content reach an endpoint that does not accept it.
- Rewriting in `llm/stream` conflicts with frozen loop requests and would bypass the Harness reconstruction invariant.
- Injecting captions only into the system prompt loses message ordering and image-to-turn association.
- Exposing vision only as a tool does not make attached images naturally available to the current user turn, and tool-returned images still reach the same text-only provider limitation.
- Storing captions only in a process cache makes resume, retry, and audit depend on nondurable state.

## Local runtime direction

The first backend uses Transformers.js, ONNX Runtime, and the MIT-licensed `onnx-community/Florence-2-base-ft` model. The repository revision is pinned to `e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f`; q4 weights are the default. Model files are downloaded on first use into `DSH_HOME/models/dsh-vision`, or the configured cache directory. The runtime is lazy-loaded and inference is serialized so simultaneous requests do not duplicate model loading or saturate a CPU host.

This path requires no Python, system package manager, CUDA installation, or resident model server. ONNX Runtime publishes Node binaries for Linux and Windows. Its npm install currently downloads CUDA and TensorRT provider libraries on Linux even when the application uses CPU inference, however. That makes the installed dependency tree much larger than the CPU runtime requires. It is an unresolved packaging issue, not a runtime requirement, and must be measured and either reduced or documented before release.

The default q4 cache has an embedded nine-file SHA-256 manifest. Cache mutation is serialized with a cross-process lock that uses Node filesystem calls on Linux and Windows. Known corrupt or interrupted files are removed before model loading so Transformers.js downloads them again, and every file is verified after download before the model becomes available. Custom model IDs, revisions, and non-q4 formats do not have a bundled manifest and therefore rely on the user-selected upstream source.

## Prototype evidence

On 2026-08-14, the real backend was run on Linux against `assets/logo.png` with an empty cache in `/tmp`. The pinned q4 model downloaded and produced a detailed, image-specific caption in 68.6 seconds. The downloaded model cache is 321 MB. A warm run with the default detailed-caption and OCR passes took 11.7 seconds and returned both visual detail and detected text. The unit suite covers lazy singleton loading, q4 and revision options, post-processing, OCR composition, cancellation during generation, retry after a failed load, cache repair, digest verification, and cross-process serialization. Windows execution remains unverified.

The bundle was also installed through the Harness `dsh plugin --profile vision-test add <checkout>` path in an isolated `DSH_HOME`. Harness recognized the bundle manifest, composed its patch over `dsh-base`, selected `dsh-vision/deepseek-v4-flash` as the default model, resolved all three plugin entry points, and stayed running until an intentional interrupt.

## Reasonix findings

Reasonix is useful UI and safety prior art, but it does not implement the proposed text-model bridge. It passes images natively to providers marked vision-capable.

Relevant behavior to retain:

- pasted images are copied into owned storage rather than retaining arbitrary source paths;
- image bytes and media types are verified, symlinks are rejected, and request-sized images are bounded;
- oversized inputs are downscaled for vision transport;
- Linux clipboard image paste currently relies on `wl-paste` or `xclip`, while Windows uses PowerShell and `System.Drawing`;
- native provider serializers attach images to user messages and move tool-result images into a following user message when the provider wire format requires it.

Harness already owns most storage and validation concerns. `dsh-tui` should later add file, drag/drop, and clipboard ingestion through the Harness attachment service; those UI actions are outside this repository.

## Initial package boundaries

- `adapter`: synthetic provider metadata, request transformation, downstream delegation, and stream forwarding.
- `descriptions`: durable event schema, cache-key derivation, session lookup, and append-before-use behavior.
- `backend`: cancellation-aware local inference interface and native-process lifecycle.
- `model-store`: pinned manifest, resumable download, digest verification, atomic publication, and cache discovery.
- `prompt`: versioned visual-analysis instructions and stable text rendering.
- `bundle`: Cordis patch that layers the attachment backend and vision adapter over a Harness base bundle.

## First milestones

1. Package scaffold plus a fake backend proving image-to-text request transformation, downstream routing, cancellation, and event reuse.
2. Native backend spike on CPU for Linux x64 and Windows x64, with benchmark fixtures covering screenshots, diagrams, documents, and photographs.
3. Verified model download and cache lifecycle with interrupted-download recovery and concurrent-start locking.
4. Installable Harness bundle and a keyless real-composition transcript proving first use and replay.
5. `dsh-tui` integration for attachment selection, paste/drop feedback, model download progress, and failures.

## Open questions

- Which session API is safe for an adapter to use while a step is active, and what event ordering constraints apply to an adapter-owned event appended between `step/start` and `assistant/message`?
- Should one description be a neutral exhaustive observation or be conditioned on the user's prompt? Neutral descriptions maximize reuse; prompt-conditioned analysis may be materially better for charts, OCR, and spatial questions.
- Should multiple images be analyzed independently, jointly, or both? Independent records cache well; joint analysis preserves comparisons and cross-image references.
- How should compaction retain descriptions and their association with image blocks?
- Does the initial model license permit automatic download and the intended redistribution path for native artifacts and tokenizer/config files?
