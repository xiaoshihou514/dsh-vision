<p align="center"><img src="assets/logo.png" width="160" alt="dsh-vision logo"></p>
<h1 align="center">dsh-vision</h1>

Local image support for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

`dsh-vision` analyzes image attachments with Florence-2 on the host, then gives the resulting description and OCR text to the existing DeepSeek route. The image stays on the machine. The generated visual evidence is sent to DeepSeek as part of the conversation and stored in the Harness session log, so retries and resumed sessions do not run inference again.

## Status

The current release supports Linux x64 and Windows x64. CPU inference, the packaged runtime, and the build are exercised on both operating systems. The full Harness plugin path is also tested on Linux.

The default model download is 321 MB. On the development machine, the first description took 68.6 seconds including download and initialization. A warm detailed-caption and OCR run took 11.7 seconds. CPU speed varies considerably by machine.

## Install

Node.js 22.19 or newer and a current DeepSeek Harness installation are required.

```sh
dsh plugin --profile web add github:xiaoshihou514/dsh-vision
```

pnpm will stop the first install because three transitive packages declare build scripts. Harness writes their names into the profile's `pnpm-workspace.yaml`. Set each generated value to `false`:

```yaml
allowBuilds:
  onnxruntime-node: false
  protobufjs: false
  sharp: false
```

Run the install command again. These scripts are not needed for CPU inference. Skipping the ONNX Runtime postinstall avoids downloading optional CUDA and TensorRT libraries on Linux. The CPU binaries are already part of the package.

The bundle selects `dsh-vision/deepseek-v4-flash` as the profile default. Configure `DEEPSEEK_API_KEY` as usual, open the profile, and attach an image to a message. The Florence model downloads from Hugging Face on first use and is cached below `$DSH_HOME/models/dsh-vision`.

## Configuration

The defaults provide a detailed caption plus a separate OCR pass. A profile patch can replace any bundle row. For example, this keeps the detailed caption but disables OCR and moves the model cache:

```yaml
- id: vision-transformers-backend
  name: dsh-vision/transformers-backend
  config:
    task: <MORE_DETAILED_CAPTION>
    includeOcr: false
    cacheDir: /path/to/model-cache
```

The adapter route can also point at another DeepSeek model or compatible text route:

```yaml
- id: vision-adapter
  name: dsh-vision
  config:
    provider: dsh-vision
    displayName: DeepSeek with local vision
    downstreamProvider: deepseek-official
    downstreamModel: deepseek-v4-flash
```

## Model cache

The default q4 model is pinned to an immutable Hugging Face revision. Nine required files are checked against SHA-256 digests. Cache writes are serialized between Harness processes, and a partial or corrupt file is removed before the next download attempt.

Custom model IDs, revisions, and weight formats are available for experiments, but only the default q4 artifact set has a bundled integrity manifest.

## Limits

- DeepSeek receives a textual representation of the image, not the original pixels. Small text, exact geometry, and fine visual details can be lost.
- Inference is CPU-first and serialized within a Harness process. It is not suitable for high-throughput image workloads.
- The first request needs network access to Hugging Face. Later requests can use the local cache.
- Descriptions are durable session data. Removing the model cache does not remove descriptions already written to session logs.

## Development

```sh
pnpm install
pnpm run check
pnpm test
pnpm run build
```

Set `DSH_VISION_E2E_IMAGE` to run the real-model test. It downloads the pinned model unless `DSH_VISION_E2E_CACHE` points to a populated cache.

```sh
DSH_VISION_E2E_IMAGE=/path/to/image.png pnpm exec vitest run tests/transformers-backend.e2e.spec.ts
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for change guidelines and [SECURITY.md](SECURITY.md) for private vulnerability reports.

[MIT](LICENSE)
