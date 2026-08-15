# Minimal backend settings

## Decision

The plugin configuration now exposes only choices that most users need:

- backend: GLM cloud or local Qwen
- GLM: API key
- Qwen: a tested model preset

GLM uses the official endpoint, the default vision model, a 2,048-token response limit, a 60-second timeout, and the fixed `ZHIPUAI_API_KEY` credential. The settings card links directly to the official API key page.

Local Qwen always tracks the model repository's `main` revision. It selects the execution provider automatically, retries on CPU if accelerated initialization fails, uses Q4 weights, limits responses to 384 new tokens, and stores downloads in `~/.dsh/vision`.

## Why Q4 is the automatic weight policy

Transformers.js 4.2 accepts `dtype: "auto"`, but with `device: "auto"` it falls back to FP32 because `auto` is not a concrete execution device. That produces an unnecessarily large first download and memory footprint. The plugin therefore presents the behavior as automatic while choosing Q4 internally. Both presets publish Q4 graphs and can run through ONNX Runtime on Linux and Windows.

## Presets

- `qwen3-vl-2b`: `onnx-community/Qwen3-VL-2B-Instruct-ONNX`, recommended
- `qwen2-vl-2b`: `onnx-community/Qwen2-VL-2B-Instruct`, compatibility option

The Qwen3-VL 4B community conversion was not added. Its ONNX Runtime GenAI layout is not compatible with the current Transformers.js loader, so presenting it would make the settings look more capable than the runtime is.

## Revision and integrity tradeoff

Tracking `main` conflicts with a hard-coded file digest manifest. The old manifest covered one Qwen3 commit and would reject every legitimate upstream update. Download serialization remains in place, while Transformers.js and the Hugging Face cache handle current repository files.

## Verification before manual inference

- TypeScript check passed.
- Unit and integration suite passed: 27 tests, with the opt-in model test skipped.
- All package entry points built successfully.
- The official GLM API key URL returned HTTP 200 on 2026-08-15.

Manual inference results are recorded separately after testing images from `~/Pictures`.
