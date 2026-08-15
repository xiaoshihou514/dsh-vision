# Settings card polish

The vision settings card now uses the same SVG disclosure chevron, rotation timing, header radius, and accessible expand/collapse label as dsh-weixin. The discard action has a proper secondary-button treatment instead of relying on browser defaults.

The GLM section calls `credentials.describe` for `ZHIPUAI_API_KEY` when it mounts and displays only whether the credential is configured. It never reads or renders the stored value. A successful credential write updates the indicator immediately.

The credential lookup is deliberately non-blocking. If the host cannot answer, the card remains editable and omits the status rather than presenting a possibly incorrect state.

Verification: TypeScript passed, all 27 non-model tests passed, the browser bundle built successfully, and generated `lib/client.js` was updated. CI files were not changed because commit `086468c` removed them while this work was in progress.
