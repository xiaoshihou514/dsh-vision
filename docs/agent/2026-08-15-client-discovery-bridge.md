# Client discovery bridge

Harness scans enabled root Loader entries for `package.json#dsh.client`. It does not resolve client declarations from subpath entries such as `dsh-vision/vision-tool`.

The bundle therefore includes a root `dsh-vision` entry whose host `apply()` is empty. Its only job is to make `lib/client.js` discoverable. The image backend, tool, and HTTP routes remain separate subpath plugins, and the root entry does not register an LLM provider or model.

Removing the old wrapper adapter without adding this bridge made both browser contributions disappear: the composer upload button and plugin settings card lived in the same undiscovered client bundle.
