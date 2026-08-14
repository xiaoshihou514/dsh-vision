/** Browser plugin entry exposed to the DeepSeek Harness module loader. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** Browser services required by dsh-vision. */
export declare const inject: readonly ['connection', 'settingsScope', 'slots']

/** Register the image upload control and native plugin settings card. */
export declare function apply(ctx: ClientContext): void
