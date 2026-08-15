# Composable image transcription

## Problem

The browser upload control translated images before submitting its own message, but the normal composer stayed active during that work. A user could therefore send the draft first and get an answer before the visual evidence arrived.

Images arriving from another plugin followed a different path. In particular, dsh-weixin correctly produced the Harness's provider-neutral image block, but that block reached the DeepSeek chat-completions adapter unchanged. The adapter is text-only and rejected the whole turn.

## Decision

There are now two boundaries, each using a native Harness contract:

- The upload control registers a session composer block for the complete translate-and-submit operation. The send button and Enter shortcut both consume this registry, so they are disabled together. Cleanup is ownership-aware: dsh-vision only removes its own reason and cannot accidentally clear a block installed by another plugin.
- A host-side `agent/pre-step` interceptor converts image blocks from any producer into plain-text visual evidence. It runs after downstream pre-step handlers, reads the durable attachment through the attachment service, and uses the selected dsh-vision backend. The rewritten message retains its id, source, ordinary text, and block order.

The second boundary is deliberately producer- and model-independent. dsh-weixin does not need to import dsh-vision or know whether the current model accepts images. Conversely, dsh-vision does not invent model variants or special routes. With the plugin enabled, visual input has one predictable meaning: transcribe it before it reaches an adapter.

## Failure behavior

If attachment reading or transcription fails, the Agent step fails before the raw image reaches the model adapter. We do not silently discard the image or retry the request without visual evidence.

The browser lock remains held until evidence submission returns, including error paths. A transcription failure is shown next to the upload control and the composer becomes available again.

## Verification

Regression tests cover:

- acquiring and releasing the native composer block;
- preserving blockers owned by other plugins;
- rewriting a dsh-weixin-style plugin message to text-only evidence;
- retaining message identity, source, user text, and block order;
- leaving text-only messages untouched;
- shipping and loading the preprocessor entry in the Cordis bundle.
