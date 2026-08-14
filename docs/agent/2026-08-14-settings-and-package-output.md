# Settings card and package output

## What was wrong

Registering a settings section on the host was not enough to make it visible in `插件配置`. The API proxy only exposes namespaces attached to configurable providers or its own allowlist. External plugins cannot extend that allowlist.

The hashed files in `lib` came from shared chunks produced by a multi-entry tsdown build. Disabling splitting alone did not stop Rolldown from extracting shared entry dependencies.

## Decisions

- Do not register a configurable LLM provider to expose settings. It creates a model-provider entry and conflicts with the no-wrapper architecture.
- Contribute a card to `settings.plugin.item` and back it with a same-origin endpoint limited to the `dsh-vision` namespace. Keep the GLM key write-only and send it directly to Harness credential storage.
- Build each public Node entry independently. This duplicates a small amount of code, but makes every published filename stable and prevents internal chunks from leaking into the package surface.
- Clean and validate `lib` in small build scripts. The finalizer fails the build if anything other than the declared public files appears.
- Keep the client declaration outside `src`; importing the client runtime declaration inside the server TypeScript program changes Cordis context augmentation and conflicts with the host-side session service type.
- Declare `slots` in the browser plugin's top-level injection list. The settings card reads `ctx.slots` directly, and Cordis rejects undeclared context service access at runtime even when another slot registration is wrapped in a scoped injection.

## Verification

- TypeScript strict check passes.
- 28 tests pass; the opt-in model-download E2E test remains skipped.
- A clean production build contains 12 predictable files and no hashed chunks.
