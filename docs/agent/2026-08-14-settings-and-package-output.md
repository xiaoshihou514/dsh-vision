# Settings card and package output

## What was wrong

Registering a settings section on the host was not enough to make it visible in `插件配置`. The API proxy only exposes namespaces attached to configurable providers (or explicitly allowlisted namespaces), and the plugin page itself is slot-driven. `dsh-vision` did neither.

The hashed files in `lib` came from shared chunks produced by a multi-entry tsdown build. Disabling splitting alone did not stop Rolldown from extracting shared entry dependencies.

## Decisions

- Register the synthetic vision provider as configurable with `settingsNs: "dsh-vision"` so its settings reach the browser API.
- Contribute a dedicated card to `settings.plugin.item`. Keep the GLM key write-only and send it directly to Harness credential storage.
- Build each public Node entry independently. This duplicates a small amount of code, but makes every published filename stable and prevents internal chunks from leaking into the package surface.
- Clean and validate `lib` in small build scripts. The finalizer fails the build if anything other than the declared public files appears.
- Keep the client declaration outside `src`; importing the client runtime declaration inside the server TypeScript program changes Cordis context augmentation and conflicts with the host-side session service type.

## Verification

- TypeScript strict check passes.
- 39 tests pass; the opt-in model-download E2E test remains skipped.
- A clean production build contains 14 predictable files and no hashed chunks.
