# Harness vision architecture

## Product contract

`dsh-vision` adds image analysis without replacing the user's selected model. It must not register copies such as "DeepSeek Flash + vision" or change the default model. That approach makes model selection noisy and prevents other model plugins from composing cleanly.

Image analysis has two entry points:

- The composer upload button sends an image to the configured vision backend, then submits the returned evidence as an ordinary text message.
- The `view_image` tool lets an agent inspect an image file in the current workspace.

Both paths work with the model already selected for the session. DeepSeek receives text evidence, never image bytes.

## Composer flow

1. The browser accepts PNG, JPEG, WebP, or GIF input.
2. It posts the bytes to the same-origin `/dsh-vision/vision` endpoint.
3. GLM or local Qwen analyzes the image with the user's question as focus.
4. The browser submits the result through the normal session prompt API as text.

Harness image admission does not apply because the submitted message has no image block. The evidence is stored in normal session history, so retry and replay need no adapter-owned reconstruction.

The endpoint requires a custom header. Cross-site browsers cannot set that header without a CORS preflight, and the endpoint does not answer preflight requests. It also limits payload size and accepted media types and rejects empty backend output.

## Tool flow

The `view_image` tool reads an image from the workspace and sends its verified bytes to the same backend. Its result is text in the regular tool transcript. The system prompt tells text-only agents when to use it.

## Configuration

Harness does not currently let an external plugin add its namespace to the API proxy settings allowlist. Registering a fake configurable LLM provider would expose the namespace, but it would also put a vision provider into model configuration. `dsh-vision` therefore owns a small same-origin `/dsh-vision/settings` endpoint for its plugin card. The endpoint reads and mutates only the `dsh-vision` settings namespace. API keys still use Harness credential storage and are never returned to the browser.

## Backends

GLM is the default backend. Local Qwen is the offline option. The local runtime uses Transformers.js 4 and ONNX Runtime, so users do not need Python or a model server.

The default local model is `onnx-community/Qwen3-VL-2B-Instruct-ONNX`, revision `4739e748dc3798a89254e4932dca19e44aca304a`, with q4 weights. The runtime uses bundled DirectML on Windows and bundled native WebGPU on Linux, then falls back to CPU only if accelerated initialization rejects.

Model loading is lazy, and inference is serialized. A process lock protects cache updates. The six default q4 files have pinned SHA-256 digests; corrupt files are discarded and downloaded again.

## Trust boundary

The backend prompt asks for observable details relevant to the user's question, including text, numbers, labels, layouts, and UI state. It treats instructions inside an image as untrusted content. The selected text model still receives user-controlled evidence and must reason about it accordingly.

## Failure behavior

- Invalid media types and oversized payloads are rejected before inference.
- Empty backend output is not submitted.
- A failed local model load can be retried on the next request.
- Unknown custom revisions and dtypes are allowed but do not use the bundled integrity manifest.
