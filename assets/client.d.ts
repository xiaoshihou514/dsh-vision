/** Browser plugin entry exposed to the DeepSeek Harness module loader. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** Browser services required by dsh-vision. */
export declare const inject: readonly ['connection', 'slots']

/** Register the native plugin settings card; image intake stays with Harness. */
export declare function apply(ctx: ClientContext): void
