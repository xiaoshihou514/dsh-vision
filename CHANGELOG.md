# Changelog

## 0.1.0 - 2026-08-14

- Add a synthetic image-capable Harness route backed by the existing DeepSeek text provider.
- Analyze local attachments with pinned q4 Florence-2 weights on Linux and Windows.
- Include detailed captions and OCR by default.
- Store derived visual evidence in the session log for deterministic retry and resume.
- Verify the default model cache with SHA-256 and serialize downloads across processes.
- Ship an installable Harness bundle and committed build output for GitHub installs.
