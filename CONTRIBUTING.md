# Contributing

Bug reports should include the operating system, Node.js version, Harness version, selected backend configuration, and the complete error. Do not attach private images or session logs without removing sensitive content.

Before opening a pull request, run:

```sh
pnpm install
pnpm run check
pnpm test
pnpm run build
```

Changes to model files or revisions must update the integrity manifest and include a real-model test result. Changes to persisted visual evidence must remain compatible with old session logs or include an explicit migration plan.

Use conventional commit subjects such as `fix: recover a partial model download`. Keep commits focused and explain user-visible tradeoffs in the pull request.
