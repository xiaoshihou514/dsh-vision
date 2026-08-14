/** Browser half: composer upload-and-recognize entry. @module dsh-vision/client */

import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import { UploadButton } from './UploadButton.tsx'
import type { UploadButtonInjected } from './UploadButton.tsx'

/** Required services (fiber inject). */
export const inject = ['connection']

/**
 * Mount the composer entry: an "upload image" control that translates the
 * selected image through the dsh-vision endpoint and submits the evidence as
 * a plain-text message, bypassing harness image admission entirely.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as { api: IApiClient }
  ctx.inject(['slots'], (scope) => {
    scope.slots.inject('conversation.input.left', () => scope.slots.register({
      name: 'conversation.input.left',
      id: 'dsh-vision-upload',
      order: 100,
      inject: (sessionId): UploadButtonInjected => ({ api, sessionId }),
    }, UploadButton))
  })
}
