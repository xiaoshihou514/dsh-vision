# Credential resolution mismatch

## Symptom

The plugin card reported `ZHIPUAI_API_KEY` as configured, while the GLM backend rejected the next image request as missing a key.

## Cause

The browser card used the Harness credential API, which writes to the configured credential provider. The backend bypassed that provider and read `process.env` directly. A value stored from the browser is not injected into the already-running process environment.

## Fix

The GLM path now resolves `ZHIPUAI_API_KEY` through `ctx.credentials` for every request. Environment variables remain a compatibility fallback when the managed service has no value. Per-request resolution is intentional: saving or rotating a key takes effect without restarting Harness, and the secret is never cached by dsh-vision.

A regression test installs an in-memory Harness credential provider, performs one request, rotates the key, and verifies that the next request uses the replacement.
