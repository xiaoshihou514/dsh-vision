# Changelog

## Unreleased

- Use the Harness's native image picker, thumbnail rail, paste, and drag/drop flow. Image evidence is generated when the turn starts and recorded as collapsed plugin context, so native uploads and dsh-weixin work with the model already selected for the session.
- Add Zhipu's free GLM vision API as the default selectable backend, with secure WebUI credential setup and automatic free-model fallbacks; retain local Qwen as the private offline option.
- Add a workspace-scoped `view_image` tool for text-only models.
- Remove the synthetic vision provider and model copies. The plugin no longer changes the default model.

## 0.1.0 - 2026-08-14

- Add a synthetic image-capable Harness route backed by the existing DeepSeek text provider.
- Analyze local attachments with pinned q4 Qwen3-VL-2B-Instruct weights.
- Automatically prefer CUDA, DirectML, CoreML, or WebGPU acceleration and fall back to CPU.
- Condition evidence extraction on the accompanying user request for document, chart, UI, and spatial questions.
- Store derived visual evidence in the session log for deterministic retry and resume.
- Verify the default model cache with SHA-256 and serialize downloads across processes.
- Ship an installable Harness bundle and committed build output for GitHub installs.
