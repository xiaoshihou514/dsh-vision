# Changelog

## Unreleased

- Add an "upload and recognize image" composer entry: the browser posts image bytes to a dsh-vision HTTP endpoint, the GLM/Qwen backend returns evidence text, and that text is submitted as a plain-text message — no harness image admission applies, so any model on the session can answer without a synthetic vision route.
- Add Zhipu's free GLM vision API as the default selectable backend, with secure WebUI credential setup and automatic free-model fallbacks; retain local Qwen as the private offline option.
- Add a workspace-scoped `view_image` tool for text-only DeepSeek routes and expose both Flash and Pro through the image-capable wrapper.

## 0.1.0 - 2026-08-14

- Add a synthetic image-capable Harness route backed by the existing DeepSeek text provider.
- Analyze local attachments with pinned q4 Qwen3-VL-2B-Instruct weights.
- Automatically prefer CUDA, DirectML, CoreML, or WebGPU acceleration and fall back to CPU.
- Condition evidence extraction on the accompanying user request for document, chart, UI, and spatial questions.
- Store derived visual evidence in the session log for deterministic retry and resume.
- Verify the default model cache with SHA-256 and serialize downloads across processes.
- Ship an installable Harness bundle and committed build output for GitHub installs.
