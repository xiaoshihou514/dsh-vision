# Native image intake and composable transcription

## Problem

The first browser integration added its own upload button, translated the image immediately, and submitted the generated description as a separate prompt. That duplicated the Harness composer, exposed machine-generated text as if the user had sent it, and made prompt timing difficult to understand.

External producers had the opposite problem. dsh-weixin correctly created provider-neutral image blocks, but the text-only DeepSeek adapter rejected them before a response could start.

## Current design

The browser plugin no longer owns image intake. The Harness composer already provides the expected attachment picker, thumbnail rail above the text field, paste and drag/drop support, validation, and one combined text-and-image submission. dsh-vision only contributes its settings card on the client.

The settings card still needs a small same-origin host bridge because the client API has no generic settings mutation remote. This is shipped as the independent `settings-api` entry. It must not be coupled to an image upload route again: removing custom image intake must not remove plugin configuration.

Local Qwen must not use Transformers.js `device: auto` on Linux. That list probes CUDA first; the npm archive omits the 302 MB CUDA provider, and even the provider's install hook still requires a separately installed CUDA 12 and cuDNN 9 runtime. The failure is logged by ONNX Runtime but does not reject session creation, so the backend silently continues on CPU and our JavaScript fallback never sees it. Use ONNX Runtime's bundled native WebGPU provider on Linux and bundled DirectML provider on Windows. Both work from the normal package install without an external compute environment; CPU remains the explicit recovery path if accelerated session creation rejects.

API Proxy performs exact-model modality admission before it stores browser attachments or wakes the Agent. DeepSeek models explicitly advertise `text` only, so `agent/pre-step` alone cannot receive a native upload. While dsh-vision is active, the preprocessor decorates exact-model metadata with the `image` input modality supplied by this plugin. It does not register an adapter, provider, model alias, or replacement route; provider and model identity remain unchanged. The decorator is removed with the plugin lifecycle.

On the host, `vision-preprocessor` listens at `agent/pre-step` after downstream handlers. For every image-bearing user message it:

1. reads each durable attachment through the attachment service;
2. asks the configured vision backend for evidence, using the user's text as focus;
3. removes image blocks from the visible user message while retaining its id, source, and authored text;
4. emits the evidence as an adjacent `dsh-vision` plugin message with `form: notice`.

The standard conversation UI renders notice context as a collapsed row. Generated evidence therefore does not appear in the user bubble, while the model receives durable text-only context. An image-only prompt gets a small `图片已识别` marker so its submitted turn does not become visually empty.

This boundary is producer-independent. Native desktop uploads, dsh-weixin, and future plugins all use the same provider-neutral image block and need no direct dependency on dsh-vision. No synthetic model routes are introduced.

## Known limitation

The native thumbnail is visible while composing, but the submitted transcript cannot retain the image block under the current Harness contract. Append-origin transcript messages are also the model-visible surface, so retaining the image would make DeepSeek reject reconstructed requests. A future upstream post-append, pre-derivation surface-replacement hook could preserve the original image in history while keeping only evidence on the model surface.

## Failure behavior

Attachment or transcription failure stops the step before a raw image reaches the adapter. The plugin does not silently discard an image or retry without its evidence. Cancellation propagates through attachment reading and inference.

## Verification targets

- native image intake is not duplicated by the client bundle;
- user-authored text remains the visible message;
- generated evidence is isolated in collapsed plugin context;
- no returned model-facing message contains an image block;
- image-only input retains a small visible marker;
- text-only messages preserve object identity and do not invoke the backend;
- the preprocessor is included in the Cordis bundle and published exports.
