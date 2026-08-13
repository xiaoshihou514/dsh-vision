# Security policy

Please report suspected vulnerabilities privately through GitHub's security advisory form for this repository. Do not open a public issue for credentials, path traversal, cache poisoning, or unintended image disclosure.

Include the affected version or commit, operating system, reproduction steps, and expected impact. Test images and session logs may contain sensitive information, so remove unrelated content before sharing them.

The default model is downloaded from Hugging Face at a pinned revision and checked against the SHA-256 manifest in the package. Image bytes remain in the Harness attachment store. Generated descriptions and OCR text are sent to the configured downstream model and should be treated as conversation data.
